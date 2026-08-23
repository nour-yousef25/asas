import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { chmodSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { validateBrokerCoverage } from './lib/w02-broker-coverage-gate.mjs';
import { recordEvidence, recordEvidenceAsync } from './lib/w02-broker-evidence-recorder.mjs';

const suffix = `${Date.now()}_${process.pid}`;
const database = `asas_broker_audit_${suffix}`;
const dbOwner = `broker_db_owner_${suffix}`;
const securityOwner = `broker_security_owner_${suffix}`;
const dataRole = `broker_tenant_data_${suffix}`;
const brokerRole = `broker_authority_${suffix}`;
const tenantA = `broker_tenant_a_${suffix}`;
const tenantB = `broker_tenant_b_${suffix}`;
const unauthenticated = `broker_unauth_${suffix}`;
const auditFile = `/tmp/w02-rls-broker-evidence-${suffix}.json`;
const sqlFile = `/tmp/w02-rls-broker-setup-${suffix}.sql`;
const organizationA = '11111111-1111-4111-8111-111111111111';
const organizationB = '22222222-2222-4222-8222-222222222222';
const userA = 'aaaaaaaa-0000-4000-8000-000000000001';
const userB = 'bbbbbbbb-0000-4000-8000-000000000002';
const membershipA = 'aaaaaaaa-0000-4000-8000-000000000101';
const membershipB = 'bbbbbbbb-0000-4000-8000-000000000102';
const membershipAInOrganizationB = 'aaaaaaaa-0000-4000-8000-000000000103';
const passwordBroker = randomBytes(30).toString('base64url');
const passwordA = randomBytes(30).toString('base64url');
const passwordB = randomBytes(30).toString('base64url');
const passwordUnauthenticated = randomBytes(30).toString('base64url');
const evidence = [];
const auditLog = [];
const startedAt = new Date().toISOString();

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', ...options });
}

function adminSql(sql, db = 'postgres') {
  const out = run('sudo', ['-u', 'postgres', 'psql', '-d', db, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql]);
  if (out.status !== 0) throw new Error(out.stderr.trim() || out.stdout.trim());
  return out.stdout.trim();
}

function sqlAs(role, password, sql, options = {}) {
  const out = run('psql', ['-h', '127.0.0.1', '-p', String(options.port ?? 5432), '-d', database, '-U', role, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', `SELECT 'META:' || session_user || ':' || pg_backend_pid(); ${sql}`], {
    env: { ...process.env, PGPASSWORD: password },
  });
  const lines = out.stdout.trim().split('\n');
  const meta = lines.shift() || '';
  const [, sessionUser = 'unknown', backendPid = 'unknown'] = meta.match(/^META:([^:]+):(.*)$/) || [];
  return { code: out.status, sessionUser, backendPid, stdout: lines.join('\n').trim(), stderr: out.stderr.trim() };
}

function sqlAsAsync(role, password, sql, options = {}) {
  return new Promise((resolve) => {
    const child = spawn('psql', ['-h', '127.0.0.1', '-p', String(options.port ?? 5432), '-d', database, '-U', role, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', `SELECT 'META:' || session_user || ':' || pg_backend_pid(); ${sql}`], { env: { ...process.env, PGPASSWORD: password } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => {
      const lines = stdout.trim().split('\n');
      const meta = lines.shift() || '';
      const [, sessionUser = 'unknown', backendPid = 'unknown'] = meta.match(/^META:([^:]+):(.*)$/) || [];
      resolve({ code, sessionUser, backendPid, stdout: lines.join('\n').trim(), stderr: stderr.trim() });
    });
  });
}

function sqlScriptAs(role, password, commands) {
  const script = [`SELECT 'META:' || session_user || ':' || pg_backend_pid();`, ...commands].join('\n');
  const out = run('psql', ['-h', '127.0.0.1', '-d', database, '-U', role, '-X', '-v', 'ON_ERROR_STOP=1', '-At'], {
    env: { ...process.env, PGPASSWORD: password }, input: script,
  });
  const lines = out.stdout.trim().split('\n');
  const meta = lines.shift() || '';
  const [, sessionUser = 'unknown', backendPid = 'unknown'] = meta.match(/^META:([^:]+):(.*)$/) || [];
  return { code: out.status, sessionUser, backendPid, stdout: lines.join('\n').trim(), stderr: out.stderr.trim() };
}

function makeContext({ userId, organizationId, membershipId, sessionVersion = 1, policySnapshotVersion = 1, correlationId = randomUUID() }) {
  return Object.freeze({ userId, organizationId, membershipId, sessionVersion, policySnapshotVersion, correlationId });
}

class BrokerDenied extends Error {
  constructor(code) { super(code); this.code = code; }
}

class CredentialAuthority {
  #credentials;
  available = true;
  timeout = false;
  constructor(credentials) { this.#credentials = credentials; }
  connect(credentialRef, query, options = {}) {
    if (!this.available) throw new BrokerDenied('AUTHORITY_UNAVAILABLE');
    if (this.timeout) throw new BrokerDenied('AUTHORITY_TIMEOUT');
    const entry = this.#credentials.get(credentialRef);
    if (!entry || entry.revoked) throw new BrokerDenied('CREDENTIAL_REVOKED');
    const out = sqlAs(entry.role, entry.password, query, options);
    if (out.code !== 0) throw new BrokerDenied(options.port ? 'POSTGRES_UNAVAILABLE' : 'POSTGRES_DENIED');
    return out;
  }
  async connectAsync(credentialRef, query, options = {}) {
    if (!this.available) throw new BrokerDenied('AUTHORITY_UNAVAILABLE');
    if (this.timeout) throw new BrokerDenied('AUTHORITY_TIMEOUT');
    const entry = this.#credentials.get(credentialRef);
    if (!entry || entry.revoked) throw new BrokerDenied('CREDENTIAL_REVOKED');
    const out = await sqlAsAsync(entry.role, entry.password, query, options);
    if (out.code !== 0) throw new BrokerDenied(options.port ? 'POSTGRES_UNAVAILABLE' : 'POSTGRES_DENIED');
    return out;
  }
  rotate(credentialRef, password) {
    const entry = this.#credentials.get(credentialRef);
    if (!entry) throw new BrokerDenied('CREDENTIAL_ABSENT');
    entry.password = password;
    entry.generation += 1;
  }
  directAuditQuery(credentialRef, query) {
    const entry = this.#credentials.get(credentialRef);
    if (!entry || entry.revoked) throw new BrokerDenied('CREDENTIAL_REVOKED');
    return sqlAs(entry.role, entry.password, query);
  }
}

class TenantAccessBroker {
  #authority;
  #leases = new Map();
  #connections = new Map();
  available = true;
  throwUnexpected = false;
  constructor(authority) { this.#authority = authority; }
  audit(decision, reason, context, lease = null) {
    auditLog.push({ timestamp: new Date().toISOString(), decision, reason, correlationId: context?.correlationId ?? 'none', organizationId: context?.organizationId ?? 'none', membershipId: context?.membershipId ?? 'none', leaseId: lease?.leaseId ?? 'none', tenantRoleId: lease?.tenantRoleId ?? 'none' });
  }
  authorityQuery(sql) {
    if (!this.available) throw new BrokerDenied('BROKER_UNAVAILABLE');
    if (this.throwUnexpected) throw new Error('AUDIT_INJECTED_BROKER_EXCEPTION');
    const out = sqlAs(brokerRole, passwordBroker, sql);
    if (out.code !== 0) throw new BrokerDenied('AUTHORITY_QUERY_DENIED');
    return out.stdout;
  }
  validate(context, requested = {}) {
    if (!context || !context.userId || !context.organizationId || !context.membershipId || !context.correlationId) throw new BrokerDenied('CONTEXT_INVALID');
    if (requested.organizationId && requested.organizationId !== context.organizationId) throw new BrokerDenied('ORGANIZATION_SPOOF');
    if (requested.membershipId && requested.membershipId !== context.membershipId) throw new BrokerDenied('MEMBERSHIP_SPOOF');
    if (requested.roleId) throw new BrokerDenied('ROLE_SPOOF');
    const row = this.authorityQuery(`SELECT u.active, u.session_version, u.revoked, m.organization_id, m.active, m.revoked, m.policy_version, m.operation_allowed FROM security.users u JOIN security.memberships m ON m.user_id=u.user_id WHERE u.user_id='${context.userId}'::uuid AND m.membership_id='${context.membershipId}'::uuid;`);
    const parts = row.split('|');
    if (parts.length !== 8) throw new BrokerDenied('MEMBERSHIP_ABSENT');
    const [userActive, sessionVersion, userRevoked, memberOrganization, membershipActive, membershipRevoked, policyVersion, operationAllowed] = parts;
    if (userActive !== 't' || userRevoked !== 'f') throw new BrokerDenied('USER_REVOKED');
    if (memberOrganization !== context.organizationId) throw new BrokerDenied('MEMBERSHIP_ORGANIZATION_MISMATCH');
    if (membershipActive !== 't' || membershipRevoked !== 'f') throw new BrokerDenied('MEMBERSHIP_REVOKED');
    if (Number(sessionVersion) !== Number(context.sessionVersion)) throw new BrokerDenied('STALE_SESSION');
    if (Number(policyVersion) !== Number(context.policySnapshotVersion)) throw new BrokerDenied('STALE_POLICY');
    if (operationAllowed !== 't') throw new BrokerDenied('POLICY_REVOKED');
    const mappings = this.authorityQuery(`SELECT tenant_role, credential_ref, active FROM security.tenant_role_mapping WHERE organization_id='${context.organizationId}'::uuid ORDER BY mapping_id;`).split('\n').filter(Boolean);
    if (mappings.length === 0) throw new BrokerDenied('MAPPING_ABSENT');
    if (mappings.length !== 1) throw new BrokerDenied('MAPPING_AMBIGUOUS');
    const [tenantRoleId, credentialRef, active] = mappings[0].split('|');
    if (active !== 't') throw new BrokerDenied('MAPPING_REVOKED');
    return { tenantRoleId, credentialRef };
  }
  issueLease(context, requested = {}) {
    try {
      const mapping = this.validate(context, requested);
      const lease = { leaseId: randomUUID(), organizationId: context.organizationId, membershipId: context.membershipId, userId: context.userId, tenantRoleId: mapping.tenantRoleId, credentialRef: mapping.credentialRef, connectionId: randomUUID(), correlationId: context.correlationId, issuedAt: Date.now(), expiresAt: Date.now() + 4_000, usedAt: null, revokedAt: null, fingerprint: createHash('sha256').update(`${context.userId}|${context.organizationId}|${context.membershipId}|${context.sessionVersion}|${context.policySnapshotVersion}`).digest('hex').slice(0, 16) };
      this.#leases.set(lease.leaseId, lease);
      this.#connections.set(lease.connectionId, lease.tenantRoleId);
      this.audit('ALLOW', 'LEASE_ISSUED', context, lease);
      return { leaseId: lease.leaseId, organizationId: lease.organizationId, tenantRoleId: lease.tenantRoleId, connectionId: lease.connectionId, correlationId: lease.correlationId, expiresAt: lease.expiresAt, fingerprint: lease.fingerprint };
    } catch (error) {
      this.audit('DENY', error.code || 'BROKER_EXCEPTION', context);
      throw error instanceof BrokerDenied ? error : new BrokerDenied('BROKER_EXCEPTION');
    }
  }
  execute(leaseDescriptor, context, query, requested = {}, options = {}) {
    try {
      const lease = this.#leases.get(leaseDescriptor?.leaseId);
      if (!lease) throw new BrokerDenied('LEASE_ABSENT');
      if (lease.revokedAt) throw new BrokerDenied('LEASE_REVOKED');
      if (lease.expiresAt <= Date.now()) throw new BrokerDenied('LEASE_EXPIRED');
      if (lease.usedAt) throw new BrokerDenied('LEASE_REPLAY');
      if (lease.connectionId !== leaseDescriptor.connectionId) throw new BrokerDenied('LEASE_CONNECTION_MISMATCH');
      if (lease.organizationId !== context.organizationId || lease.membershipId !== context.membershipId || lease.userId !== context.userId || lease.correlationId !== context.correlationId) throw new BrokerDenied('LEASE_CONTEXT_MISMATCH');
      const mapping = this.validate(context, requested);
      if (mapping.tenantRoleId !== lease.tenantRoleId || mapping.credentialRef !== lease.credentialRef) throw new BrokerDenied('LEASE_MAPPING_MISMATCH');
      if (this.#connections.get(lease.connectionId) !== lease.tenantRoleId) throw new BrokerDenied('POOL_PARTITION_MISMATCH');
      const result = this.#authority.connect(lease.credentialRef, query, options);
      if (result.sessionUser !== lease.tenantRoleId) throw new BrokerDenied('DATABASE_IDENTITY_MISMATCH');
      lease.usedAt = Date.now();
      this.audit('ALLOW', 'LEASE_EXECUTED', context, lease);
      return { stdout: result.stdout, sessionUser: result.sessionUser, backendPid: result.backendPid };
    } catch (error) {
      this.audit('DENY', error.code || 'BROKER_EXCEPTION', context, this.#leases.get(leaseDescriptor?.leaseId));
      throw error instanceof BrokerDenied ? error : new BrokerDenied('BROKER_EXCEPTION');
    }
  }
  async executeConcurrent(leaseDescriptor, context, query, requested = {}, options = {}) {
    try {
      const lease = this.#leases.get(leaseDescriptor?.leaseId);
      if (!lease) throw new BrokerDenied('LEASE_ABSENT');
      if (lease.revokedAt) throw new BrokerDenied('LEASE_REVOKED');
      if (lease.expiresAt <= Date.now()) throw new BrokerDenied('LEASE_EXPIRED');
      if (lease.usedAt) throw new BrokerDenied('LEASE_REPLAY');
      if (lease.connectionId !== leaseDescriptor.connectionId) throw new BrokerDenied('LEASE_CONNECTION_MISMATCH');
      if (lease.organizationId !== context.organizationId || lease.membershipId !== context.membershipId || lease.userId !== context.userId || lease.correlationId !== context.correlationId) throw new BrokerDenied('LEASE_CONTEXT_MISMATCH');
      const mapping = this.validate(context, requested);
      if (mapping.tenantRoleId !== lease.tenantRoleId || mapping.credentialRef !== lease.credentialRef) throw new BrokerDenied('LEASE_MAPPING_MISMATCH');
      if (this.#connections.get(lease.connectionId) !== lease.tenantRoleId) throw new BrokerDenied('POOL_PARTITION_MISMATCH');
      const result = await this.#authority.connectAsync(lease.credentialRef, query, options);
      if (result.sessionUser !== lease.tenantRoleId) throw new BrokerDenied('DATABASE_IDENTITY_MISMATCH');
      lease.usedAt = Date.now();
      this.audit('ALLOW', 'LEASE_EXECUTED', context, lease);
      return { stdout: result.stdout, sessionUser: result.sessionUser, backendPid: result.backendPid };
    } catch (error) {
      this.audit('DENY', error.code || 'BROKER_EXCEPTION', context, this.#leases.get(leaseDescriptor?.leaseId));
      throw error instanceof BrokerDenied ? error : new BrokerDenied('BROKER_EXCEPTION');
    }
  }
  revokeLease(leaseId) { const lease = this.#leases.get(leaseId); if (lease) lease.revokedAt = Date.now(); }
  expireLease(leaseId) { const lease = this.#leases.get(leaseId); if (lease) lease.expiresAt = Date.now() - 1; }
  markConnectionStale(connectionId) { if (this.#connections.has(connectionId)) this.#connections.set(connectionId, 'STALE'); }
  poolTenant(connectionId) { return this.#connections.get(connectionId) ?? 'ABSENT'; }
}

function record(id, purpose, inputClass, expected, fn, pass) {
  evidence.push(recordEvidence({
    id, purpose, setup: 'disposable PostgreSQL audit fixture and broker harness', command: 'broker-harness', inputClass, expected,
    execute: (correlationId) => fn(correlationId),
    evaluate: ({ output, error }) => pass(error ? { error: error.code || error.name || 'UNEXPECTED' } : output),
    metadata: ({ output }) => ({
      databaseIdentity: output?.databaseIdentity ?? output?.sessionUser ?? 'none',
      tenant: output?.tenant ?? output?.organizationId ?? 'none',
      organization: output?.organizationId ?? null,
      membershipId: output?.membershipId ?? null,
      leaseId: output?.leaseId ?? null,
      tenantRoleId: output?.tenantRoleId ?? output?.sessionUser ?? null,
    }),
  }));
}

async function recordAsync(id, purpose, inputClass, expected, fn, pass) {
  evidence.push(await recordEvidenceAsync({
    id, purpose, setup: 'disposable PostgreSQL audit fixture and broker harness', command: 'broker-harness-concurrent', inputClass, expected,
    execute: (correlationId) => fn(correlationId),
    evaluate: ({ output, error }) => pass(error ? { error: error.code || error.name || 'UNEXPECTED' } : output),
    metadata: ({ output }) => ({
      databaseIdentity: output?.databaseIdentity ?? output?.sessionUser ?? 'none',
      tenant: output?.tenant ?? output?.organizationId ?? 'none',
      organization: output?.organizationId ?? null,
      membershipId: output?.membershipId ?? null,
      leaseId: output?.leaseId ?? null,
      tenantRoleId: output?.tenantRoleId ?? null,
    }),
  }));
}

function setup() {
  adminSql(`CREATE ROLE ${dbOwner} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;`);
  adminSql(`CREATE ROLE ${securityOwner} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;`);
  adminSql(`CREATE ROLE ${dataRole} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;`);
  adminSql(`CREATE ROLE ${brokerRole} LOGIN NOINHERIT NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION PASSWORD '${passwordBroker}';`);
  adminSql(`CREATE ROLE ${tenantA} LOGIN NOINHERIT NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION PASSWORD '${passwordA}';`);
  adminSql(`CREATE ROLE ${tenantB} LOGIN NOINHERIT NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION PASSWORD '${passwordB}';`);
  adminSql(`CREATE ROLE ${unauthenticated} LOGIN NOINHERIT NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION PASSWORD '${passwordUnauthenticated}';`);
  adminSql(`GRANT ${dataRole} TO ${tenantA} WITH INHERIT TRUE, SET FALSE;`);
  adminSql(`GRANT ${dataRole} TO ${tenantB} WITH INHERIT TRUE, SET FALSE;`);
  adminSql(`CREATE DATABASE ${database} OWNER ${dbOwner};`);
  const sql = `
REVOKE ALL ON DATABASE ${database} FROM PUBLIC;
GRANT CONNECT ON DATABASE ${database} TO ${brokerRole}, ${tenantA}, ${tenantB}, ${unauthenticated};
CREATE SCHEMA proof AUTHORIZATION ${dbOwner};
CREATE SCHEMA security AUTHORIZATION ${securityOwner};
REVOKE ALL ON SCHEMA proof FROM PUBLIC; REVOKE ALL ON SCHEMA security FROM PUBLIC;
GRANT USAGE ON SCHEMA proof TO ${dataRole}; GRANT USAGE ON SCHEMA security TO ${dataRole}, ${brokerRole};
SET ROLE ${securityOwner};
CREATE TABLE security.users (user_id uuid PRIMARY KEY, active boolean NOT NULL, session_version integer NOT NULL, revoked boolean NOT NULL DEFAULT false);
CREATE TABLE security.memberships (membership_id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES security.users(user_id), organization_id uuid NOT NULL, active boolean NOT NULL, revoked boolean NOT NULL DEFAULT false, policy_version integer NOT NULL, operation_allowed boolean NOT NULL DEFAULT true);
CREATE TABLE security.tenant_role_mapping (mapping_id uuid PRIMARY KEY, organization_id uuid NOT NULL, tenant_role text NOT NULL, credential_ref text NOT NULL, active boolean NOT NULL DEFAULT true);
CREATE TABLE security.role_organization (role_oid oid PRIMARY KEY, organization_id uuid NOT NULL UNIQUE, active boolean NOT NULL DEFAULT true);
INSERT INTO security.users VALUES ('${userA}', true, 1, false), ('${userB}', true, 1, false);
INSERT INTO security.memberships VALUES ('${membershipA}','${userA}','${organizationA}',true,false,1,true), ('${membershipB}','${userB}','${organizationB}',true,false,1,true), ('${membershipAInOrganizationB}','${userA}','${organizationB}',true,false,1,true);
INSERT INTO security.tenant_role_mapping VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','${organizationA}','${tenantA}','cred-a',true), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','${organizationB}','${tenantB}','cred-b',true);
INSERT INTO security.role_organization VALUES ('${tenantA}'::regrole::oid,'${organizationA}',true), ('${tenantB}'::regrole::oid,'${organizationB}',true);
CREATE FUNCTION security.current_organization() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, security AS $$ SELECT organization_id FROM security.role_organization WHERE role_oid=session_user::regrole::oid AND active $$;
REVOKE ALL ON ALL TABLES IN SCHEMA security FROM PUBLIC; REVOKE ALL ON FUNCTION security.current_organization() FROM PUBLIC;
GRANT SELECT ON security.users, security.memberships, security.tenant_role_mapping TO ${brokerRole};
GRANT EXECUTE ON FUNCTION security.current_organization() TO ${dataRole}; GRANT USAGE ON SCHEMA security TO ${dbOwner};
RESET ROLE;
SET ROLE ${dbOwner};
CREATE TABLE proof.records (id uuid PRIMARY KEY, organization_id uuid NOT NULL, label text NOT NULL);
CREATE TABLE proof.record_children (id uuid PRIMARY KEY, record_id uuid NOT NULL REFERENCES proof.records(id), organization_id uuid NOT NULL, label text NOT NULL);
INSERT INTO proof.records VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${organizationA}','record-a'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${organizationB}','record-b');
INSERT INTO proof.record_children VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${organizationA}','child-a'),('dddddddd-dddd-4ddd-8ddd-dddddddddddd','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${organizationB}','child-b');
GRANT SELECT, INSERT, UPDATE, DELETE ON proof.records, proof.record_children TO ${dataRole};
ALTER TABLE proof.records ENABLE ROW LEVEL SECURITY; ALTER TABLE proof.record_children ENABLE ROW LEVEL SECURITY;
CREATE POLICY proof_records ON proof.records FOR ALL TO ${dataRole} USING (organization_id=security.current_organization()) WITH CHECK (organization_id=security.current_organization());
CREATE POLICY proof_children ON proof.record_children FOR ALL TO ${dataRole} USING (organization_id=security.current_organization()) WITH CHECK (organization_id=security.current_organization());
ALTER TABLE proof.records FORCE ROW LEVEL SECURITY; ALTER TABLE proof.record_children FORCE ROW LEVEL SECURITY;
RESET ROLE;`;
  const out = run('sudo', ['-u', 'postgres', 'psql', '-d', database, '-X', '-v', 'ON_ERROR_STOP=1'], { input: sql });
  if (out.status !== 0) throw new Error(out.stderr.trim() || out.stdout.trim());
}

function cleanupAuditResources() {
  const errors = [];
  const roles = [tenantA, tenantB, unauthenticated, brokerRole, dataRole, securityOwner, dbOwner];
  try { adminSql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${database}' AND pid <> pg_backend_pid();`); } catch (error) { errors.push(`TERMINATE:${error.message}`); }
  try { adminSql(`DROP DATABASE IF EXISTS ${database};`); } catch (error) { errors.push(`DROP_DATABASE:${error.message}`); }
  for (const role of roles) {
    try { adminSql(`DROP ROLE IF EXISTS ${role};`); } catch (error) { errors.push(`DROP_ROLE:${role}:${error.message}`); }
  }
  let residualDatabases = [];
  let residualRoles = [];
  try { residualDatabases = adminSql(`SELECT datname FROM pg_database WHERE datname='${database}';`).split('\n').filter(Boolean); } catch (error) { errors.push(`VERIFY_DATABASE:${error.message}`); }
  try { residualRoles = adminSql(`SELECT rolname FROM pg_roles WHERE rolname IN (${roles.map((role) => `'${role}'`).join(',')}) ORDER BY rolname;`).split('\n').filter(Boolean); } catch (error) { errors.push(`VERIFY_ROLES:${error.message}`); }
  try { rmSync(sqlFile, { force: true }); } catch (error) { errors.push(`REMOVE_SQL_FILE:${error.message}`); }
  return { ok: errors.length === 0 && residualDatabases.length === 0 && residualRoles.length === 0, residualDatabases, residualRoles, errors };
}

function installSignalCleanup() {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      const cleanup = cleanupAuditResources();
      try {
        writeFileSync(auditFile, `${JSON.stringify({ status: cleanup.ok ? 'FAIL_INTERRUPTED' : 'FAIL_CLEANUP', startedAt, finishedAt: new Date().toISOString(), databaseAlias: database, interruption: signal, cleanup }, null, 2)}\n`, { mode: 0o600 });
        chmodSync(auditFile, 0o600);
      } catch {}
      process.exit(2);
    });
  }
}

function classifyHarnessError(error) {
  const name = String(error?.name || 'Error');
  if (name === 'ReferenceError') return 'REFERENCE_ERROR';
  if (name === 'TypeError') return 'TYPE_ERROR';
  if (name === 'SyntaxError') return 'SYNTAX_ERROR';
  if (name === 'RangeError') return 'RANGE_ERROR';
  return 'HARNESS_ERROR';
}

async function main() {
  setup();
  const authority = new CredentialAuthority(new Map([
    ['cred-a', { role: tenantA, password: passwordA, generation: 1, revoked: false }],
    ['cred-b', { role: tenantB, password: passwordB, generation: 1, revoked: false }],
  ]));
  const broker = new TenantAccessBroker(authority);
  const contextA = () => makeContext({ userId: userA, organizationId: organizationA, membershipId: membershipA });
  const contextB = () => makeContext({ userId: userB, organizationId: organizationB, membershipId: membershipB });
  const leaseA = (corr) => broker.issueLease(makeContext({ userId: userA, organizationId: organizationA, membershipId: membershipA, correlationId: corr }));
  const leaseB = (corr) => broker.issueLease(makeContext({ userId: userB, organizationId: organizationB, membershipId: membershipB, correlationId: corr }));

  if (process.env.W02_B16_ONLY === '1') {
    record('B16', 'cross-organization membership denied', 'user A, organization A, existing membership of A in B', 'DENY MEMBERSHIP_ORGANIZATION_MISMATCH', (c) => broker.issueLease(makeContext({userId:userA,organizationId:organizationA,membershipId:membershipAInOrganizationB,correlationId:c})), (o) => o.error === 'MEMBERSHIP_ORGANIZATION_MISMATCH');
    const hardFailures = evidence.filter((item) => item.result !== 'PASS').map((item) => item.id);
    const payload = { status: hardFailures.length === 0 ? 'PASS_B16_CONTRACT_FIX' : 'FAIL', startedAt, finishedAt: new Date().toISOString(), databaseAlias: database, postgresVersion: adminSql('SHOW server_version;'), evidence, auditLog, hardFailures, scope: 'B16 fixture-only proof' };
    payload.cleanup = cleanupAuditResources();
    if (!payload.cleanup.ok) payload.status = 'FAIL_CLEANUP';
    writeFileSync(auditFile, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    chmodSync(auditFile, 0o600);
    process.stdout.write(`${JSON.stringify({ status: payload.status, evidenceFile: auditFile, databaseAlias: database, hardFailures }, null, 2)}\n`);
    process.exitCode = payload.status === 'PASS_B16_CONTRACT_FIX' ? 0 : 2;
    return;
  }

  record('B01', 'A exact broker selection', 'trusted context A', 'A lease and A identity', (c) => { const l=leaseA(c); return broker.execute(l, makeContext({ userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c }), 'SELECT session_user,label FROM proof.records;'); }, (o) => o.sessionUser === tenantA && o.stdout === `${tenantA}|record-a`);
  record('B02', 'B exact broker selection', 'trusted context B', 'B lease and B identity', (c) => { const l=leaseB(c); return broker.execute(l, makeContext({ userId:userB,organizationId:organizationB,membershipId:membershipB,correlationId:c }), 'SELECT session_user,label FROM proof.records;'); }, (o) => o.sessionUser === tenantB && o.stdout === `${tenantB}|record-b`);
  record('B03', 'A cannot read B through broker', 'A lease foreign query', 'zero rows', (c) => { const l=leaseA(c); return broker.execute(l, makeContext({ userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c }), `SELECT count(*) FROM proof.records WHERE organization_id='${organizationB}';`); }, (o) => o.stdout === '0');
  record('B04', 'B cannot read A through broker', 'B lease foreign query', 'zero rows', (c) => { const l=leaseB(c); return broker.execute(l, makeContext({ userId:userB,organizationId:organizationB,membershipId:membershipB,correlationId:c }), `SELECT count(*) FROM proof.records WHERE organization_id='${organizationA}';`); }, (o) => o.stdout === '0');
  record('B05', 'A cannot read B under complete success group', 'valid A lease querying B-owned data', 'foreign result zero', (c) => { const l=leaseA(c); return broker.execute(l, makeContext({userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c}), `SELECT count(*) FROM proof.records WHERE organization_id='${organizationB}';`); }, (o) => o.sessionUser === tenantA && o.stdout === '0');
  record('B06', 'B cannot read A under complete success group', 'valid B lease querying A-owned data', 'foreign result zero', (c) => { const l=leaseB(c); return broker.execute(l, makeContext({userId:userB,organizationId:organizationB,membershipId:membershipB,correlationId:c}), `SELECT count(*) FROM proof.records WHERE organization_id='${organizationA}';`); }, (o) => o.sessionUser === tenantB && o.stdout === '0');
  record('B07', 'A request organization B denied', 'payload org override', 'DENY ORGANIZATION_SPOOF', (c) => broker.issueLease(makeContext({userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c}), { organizationId: organizationB }), (o) => o.error === 'ORGANIZATION_SPOOF');
  record('B08', 'B request organization A denied', 'payload org override', 'DENY ORGANIZATION_SPOOF', (c) => broker.issueLease(makeContext({userId:userB,organizationId:organizationB,membershipId:membershipB,correlationId:c}), { organizationId: organizationA }), (o) => o.error === 'ORGANIZATION_SPOOF');
  record('B09', 'forged organizationId matrix variant denied', 'request-supplied organizationId B under trusted A context', 'DENY ORGANIZATION_SPOOF', (c) => broker.issueLease(makeContext({userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c}), { organizationId: organizationB }), (o) => o.error === 'ORGANIZATION_SPOOF');
  record('B10', 'forged role denied', 'roleId payload', 'DENY ROLE_SPOOF', (c) => broker.issueLease(makeContext({userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c}), { roleId: tenantB }), (o) => o.error === 'ROLE_SPOOF');
  record('B11', 'forged membership denied', 'membership payload', 'DENY MEMBERSHIP_SPOOF', (c) => broker.issueLease(makeContext({userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c}), { membershipId: membershipB }), (o) => o.error === 'MEMBERSHIP_SPOOF');
  record('B12', 'post-validation request mutation no effect', 'lease A + changed context org B', 'DENY LEASE_CONTEXT_MISMATCH', (c) => { const l=leaseA(c); return broker.execute(l, makeContext({userId:userA,organizationId:organizationB,membershipId:membershipA,correlationId:c}), 'SELECT 1;'); }, (o) => o.error === 'LEASE_CONTEXT_MISMATCH');
  record('B13', 'missing membership denied', 'unknown membership', 'DENY MEMBERSHIP_ABSENT', (c) => broker.issueLease(makeContext({userId:userA,organizationId:organizationA,membershipId:'aaaaaaaa-0000-4000-8000-000000000999',correlationId:c})), (o) => o.error === 'MEMBERSHIP_ABSENT');
  adminSql(`UPDATE security.memberships SET active=false WHERE membership_id='${membershipA}';`, database);
  record('B14', 'disabled membership denied', 'disabled A membership', 'DENY MEMBERSHIP_REVOKED', (c) => leaseA(c), (o) => o.error === 'MEMBERSHIP_REVOKED');
  adminSql(`UPDATE security.memberships SET active=true, revoked=false WHERE membership_id='${membershipA}';`, database);
  adminSql(`UPDATE security.memberships SET revoked=true WHERE membership_id='${membershipA}';`, database);
  record('B15', 'revoked membership denied', 'revoked A membership', 'DENY MEMBERSHIP_REVOKED', (c) => leaseA(c), (o) => o.error === 'MEMBERSHIP_REVOKED');
  adminSql(`UPDATE security.memberships SET revoked=false WHERE membership_id='${membershipA}';`, database);
  record('B16', 'cross-organization membership denied', 'A user membership in B organization', 'DENY membership organization mismatch', (c) => broker.issueLease(makeContext({userId:userA,organizationId:organizationA,membershipId:membershipAInOrganizationB,correlationId:c})), (o) => o.error === 'MEMBERSHIP_ORGANIZATION_MISMATCH');
  adminSql(`UPDATE security.users SET session_version=2 WHERE user_id='${userA}';`, database);
  record('B17', 'stale session denied', 'A session v1 vs authority v2', 'DENY STALE_SESSION', (c) => leaseA(c), (o) => o.error === 'STALE_SESSION');
  adminSql(`UPDATE security.users SET session_version=1 WHERE user_id='${userA}';`, database);
  adminSql(`UPDATE security.users SET revoked=true WHERE user_id='${userA}';`, database);
  record('B18', 'revoked session denied', 'revoked user session', 'DENY USER_REVOKED', (c) => leaseA(c), (o) => o.error === 'USER_REVOKED');
  adminSql(`UPDATE security.users SET revoked=false WHERE user_id='${userA}';`, database);
  adminSql(`UPDATE security.memberships SET policy_version=2 WHERE membership_id='${membershipA}';`, database);
  record('B19', 'stale policy denied', 'A policy v1 vs authority v2', 'DENY STALE_POLICY', (c) => leaseA(c), (o) => o.error === 'STALE_POLICY');
  adminSql(`UPDATE security.memberships SET policy_version=1, operation_allowed=false WHERE membership_id='${membershipA}';`, database);
  record('B20', 'revoked policy denied', 'A operation policy denied', 'DENY POLICY_REVOKED', (c) => leaseA(c), (o) => o.error === 'POLICY_REVOKED');
  adminSql(`UPDATE security.memberships SET operation_allowed=true WHERE membership_id='${membershipA}';`, database);
  record('B21', 'lease belongs only to A', 'A lease descriptor', 'exact A role/org', (c) => leaseA(c), (o) => o.organizationId === organizationA && o.tenantRoleId === tenantA && !Object.keys(o).some((key) => /password|credential/i.test(key)));
  record('B22', 'A lease cannot be reused for B', 'A lease B context', 'DENY LEASE_CONTEXT_MISMATCH', (c) => { const l=leaseA(c); return broker.execute(l, makeContext({userId:userB,organizationId:organizationB,membershipId:membershipB,correlationId:c}), 'SELECT 1;'); }, (o) => o.error === 'LEASE_CONTEXT_MISMATCH');
  record('B23', 'expired lease denied', 'expired A lease', 'DENY LEASE_EXPIRED', (c) => { const l=leaseA(c); broker.expireLease(l.leaseId); return broker.execute(l, makeContext({userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c}), 'SELECT 1;'); }, (o) => o.error === 'LEASE_EXPIRED');
  record('B24', 'revoked lease denied', 'revoked A lease', 'DENY LEASE_REVOKED', (c) => { const l=leaseA(c); broker.revokeLease(l.leaseId); return broker.execute(l, makeContext({userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c}), 'SELECT 1;'); }, (o) => o.error === 'LEASE_REVOKED');
  record('B25', 'lease replay denied', 'same A lease twice', 'second execution DENY LEASE_REPLAY', (c) => { const l=leaseA(c); const ctx=makeContext({userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c}); broker.execute(l, ctx, 'SELECT 1;'); return broker.execute(l, ctx, 'SELECT 1;'); }, (o) => o.error === 'LEASE_REPLAY');
  record('B26', 'lease copied to different connection denied', 'A lease altered connection', 'DENY LEASE_CONNECTION_MISMATCH', (c) => { const l=leaseA(c); return broker.execute({ ...l, connectionId: randomUUID() }, makeContext({userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c}), 'SELECT 1;'); }, (o) => o.error === 'LEASE_CONNECTION_MISMATCH');
  record('B27', 'A lease cannot be presented with B context', 'A lease plus B context', 'DENY LEASE_CONTEXT_MISMATCH', (c) => { const l=leaseA(c); return broker.execute(l, makeContext({userId:userB,organizationId:organizationB,membershipId:membershipB,correlationId:c}), 'SELECT 1;'); }, (o) => o.error === 'LEASE_CONTEXT_MISMATCH');
  broker.available = false;
  record('B28', 'broker unavailable fails closed', 'broker flag unavailable', 'DENY BROKER_UNAVAILABLE', (c) => leaseA(c), (o) => o.error === 'BROKER_UNAVAILABLE');
  broker.available = true;
  authority.available = false;
  record('B29', 'credential authority unavailable fails closed', 'authority unavailable after lease', 'DENY AUTHORITY_UNAVAILABLE', (c) => { const l=leaseA(c); return broker.execute(l, makeContext({userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c}), 'SELECT 1;'); }, (o) => o.error === 'AUTHORITY_UNAVAILABLE');
  authority.available = true;
  record('B30', 'PostgreSQL unavailable fails closed', 'invalid audit port after lease', 'DENY POSTGRES_UNAVAILABLE', (c) => { const l=leaseA(c); return broker.execute(l, makeContext({userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c}), 'SELECT 1;', {}, { port: 1 }); }, (o) => o.error === 'POSTGRES_UNAVAILABLE');
  adminSql(`DELETE FROM security.tenant_role_mapping WHERE organization_id='${organizationA}';`, database);
  record('B31', 'mapping unavailable fails closed', 'A without map', 'DENY MAPPING_ABSENT', (c) => leaseA(c), (o) => o.error === 'MAPPING_ABSENT');
  adminSql(`INSERT INTO security.tenant_role_mapping VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','${organizationA}','${tenantA}','cred-a',true);`, database);
  adminSql(`INSERT INTO security.tenant_role_mapping VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','${organizationA}','${tenantA}','cred-a',true);`, database);
  record('B32', 'ambiguous mapping fails closed', 'two A maps', 'DENY MAPPING_AMBIGUOUS', (c) => leaseA(c), (o) => o.error === 'MAPPING_AMBIGUOUS');
  adminSql(`DELETE FROM security.tenant_role_mapping WHERE mapping_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';`, database);
  adminSql(`UPDATE security.tenant_role_mapping SET active=false WHERE organization_id='${organizationA}';`, database);
  record('B33', 'revoked mapping fails closed', 'inactive A map', 'DENY MAPPING_REVOKED', (c) => leaseA(c), (o) => o.error === 'MAPPING_REVOKED');
  adminSql(`UPDATE security.tenant_role_mapping SET active=true WHERE organization_id='${organizationA}';`, database);
  authority.timeout = true;
  record('B34', 'authority timeout fails closed', 'authority timeout after lease', 'DENY AUTHORITY_TIMEOUT', (c) => { const l=leaseA(c); return broker.execute(l, makeContext({userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c}), 'SELECT 1;'); }, (o) => o.error === 'AUTHORITY_TIMEOUT');
  authority.timeout = false;
  broker.throwUnexpected = true;
  record('B35', 'unexpected broker exception fails closed', 'injected broker exception', 'DENY BROKER_EXCEPTION', (c) => leaseA(c), (o) => o.error === 'BROKER_EXCEPTION');
  broker.throwUnexpected = false;
  record('B36', 'application receives no universal credential', 'lease public descriptor', 'no credential/password key', (c) => leaseA(c), (o) => !Object.keys(o).some((key) => /password|credential/i.test(key)) && o.tenantRoleId === tenantA);
  record('B37', 'credential material absent from source', 'generated audit credentials', 'no generated password literal in source', () => ({ sourceHasGeneratedCredential: readFileSync(new URL(import.meta.url), 'utf8').includes(passwordA) || readFileSync(new URL(import.meta.url), 'utf8').includes(passwordB) }), (o) => o.sourceHasGeneratedCredential === false);
  record('B38', 'credential material absent from audit log', 'redacted decision audit', 'no generated password in audit log', () => ({ auditHasGeneratedCredential: JSON.stringify(auditLog).includes(passwordA) || JSON.stringify(auditLog).includes(passwordB) }), (o) => o.auditHasGeneratedCredential === false);
  record('B39', 'credential material absent from evidence draft', 'redacted evidence records', 'no generated password in evidence', () => ({ evidenceHasGeneratedCredential: JSON.stringify(evidence).includes(passwordA) || JSON.stringify(evidence).includes(passwordB) }), (o) => o.evidenceHasGeneratedCredential === false);
  record('B40', 'A credential cannot authenticate as B', 'A password with B role', 'connection deny', () => sqlAs(tenantB, passwordA, 'SELECT 1;'), (o) => o.code !== 0);
  record('B41', 'B credential cannot authenticate as A', 'B password with A role', 'connection deny', () => sqlAs(tenantA, passwordB, 'SELECT 1;'), (o) => o.code !== 0);
  record('B42', 'pool partitions A and B principals', 'one A lease and one B lease', 'distinct connection/role partitions', (c) => { const a=leaseA(c); const b=leaseB(randomUUID()); return { aRole: broker.poolTenant(a.connectionId), bRole: broker.poolTenant(b.connectionId), aConnection:a.connectionId, bConnection:b.connectionId }; }, (o) => o.aRole === tenantA && o.bRole === tenantB && o.aConnection !== o.bConnection);
  record('B43', 'DISCARD ALL retains authenticated A identity', 'direct A connection reset', 'session_user remains A', () => sqlScriptAs(tenantA, passwordA, ['SELECT session_user;', 'DISCARD ALL;', 'SELECT session_user;']), (o) => o.code === 0 && o.stdout.split('\n').filter((line) => line === tenantA).length === 2);
  record('B44', 'stale pooled connection denied', 'A lease marked stale', 'DENY POOL_PARTITION_MISMATCH', (c) => { const l=leaseA(c); broker.markConnectionStale(l.connectionId); return broker.execute(l, makeContext({userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c}), 'SELECT 1;'); }, (o) => o.error === 'POOL_PARTITION_MISMATCH');
  record('B45', 'pool partitioning preserves tenant identities', 'separate A and B leases/pools', 'distinct A/B pool tenant identities', (c) => { const a=leaseA(c); const b=leaseB(randomUUID()); return { aPool:broker.poolTenant(a.connectionId), bPool:broker.poolTenant(b.connectionId), aConnection:a.connectionId, bConnection:b.connectionId }; }, (o) => o.aPool === tenantA && o.bPool === tenantB && o.aConnection !== o.bConnection && o.aPool !== o.bPool);
  await recordAsync('B46', 'concurrent A/B requests have no cross-talk', 'parallel A and B tenant broker executions', 'A sees A; B sees B; distinct identities', async (c) => { const a=leaseA(c); const bCorrelation=randomUUID(); const b=leaseB(bCorrelation); const [aOut,bOut]=await Promise.all([broker.executeConcurrent(a,makeContext({userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c}),'SELECT session_user,label FROM proof.records;'), broker.executeConcurrent(b,makeContext({userId:userB,organizationId:organizationB,membershipId:membershipB,correlationId:bCorrelation}),'SELECT session_user,label FROM proof.records;')]); return { aIdentity:aOut.sessionUser,bIdentity:bOut.sessionUser,aRows:aOut.stdout,bRows:bOut.stdout,aPid:aOut.backendPid,bPid:bOut.backendPid,databaseIdentity:`${aOut.sessionUser}|${bOut.sessionUser}`,organizationId:`${organizationA}|${organizationB}`,membershipId:`${membershipA}|${membershipB}`,leaseId:`${a.leaseId}|${b.leaseId}`,tenantRoleId:`${a.tenantRoleId}|${b.tenantRoleId}` }; }, (o) => o.aIdentity === tenantA && o.bIdentity === tenantB && o.aRows === `${tenantA}|record-a` && o.bRows === `${tenantB}|record-b` && o.aPid !== o.bPid);
  record('B47', 'release/reacquire does not inherit tenant', 'A then B fresh leases', 'A and B exact role', (c) => { const a=leaseA(c); const ctxA=makeContext({userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c}); const aOut=broker.execute(a,ctxA,'SELECT session_user;'); const corrB=randomUUID(); const b=leaseB(corrB); const bOut=broker.execute(b,makeContext({userId:userB,organizationId:organizationB,membershipId:membershipB,correlationId:corrB}),'SELECT session_user;'); return { a:aOut.sessionUser,b:bOut.sessionUser }; }, (o) => o.a === tenantA && o.b === tenantB);
  record('B48', 'membership revocation denies new lease', 'revoked A membership', 'DENY MEMBERSHIP_REVOKED', (c) => { adminSql(`UPDATE security.memberships SET revoked=true WHERE membership_id='${membershipA}';`, database); try { return leaseA(c); } finally { adminSql(`UPDATE security.memberships SET revoked=false WHERE membership_id='${membershipA}';`, database); } }, (o) => o.error === 'MEMBERSHIP_REVOKED');
  record('B49', 'mapping revocation denies new lease', 'revoked A mapping', 'DENY MAPPING_REVOKED', (c) => { adminSql(`UPDATE security.tenant_role_mapping SET active=false WHERE organization_id='${organizationA}';`, database); try { return leaseA(c); } finally { adminSql(`UPDATE security.tenant_role_mapping SET active=true WHERE organization_id='${organizationA}';`, database); } }, (o) => o.error === 'MAPPING_REVOKED');
  record('B50', 'session revocation denies new lease', 'revoked A session', 'DENY USER_REVOKED', (c) => { adminSql(`UPDATE security.users SET revoked=true WHERE user_id='${userA}';`, database); try { return leaseA(c); } finally { adminSql(`UPDATE security.users SET revoked=false WHERE user_id='${userA}';`, database); } }, (o) => o.error === 'USER_REVOKED');
  record('B51', 'lease expiry denies database access', 'expired A lease', 'DENY LEASE_EXPIRED', (c) => { const l=leaseA(c); broker.expireLease(l.leaseId); return broker.execute(l,makeContext({userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c}),'SELECT 1;'); }, (o) => o.error === 'LEASE_EXPIRED');
  record('B52', 'old A credential denied after rotation', 'old A password', 'connection deny', () => { const old=passwordA; const next=randomBytes(30).toString('base64url'); adminSql(`ALTER ROLE ${tenantA} PASSWORD '${next}';`); authority.rotate('cred-a', next); return sqlAs(tenantA, old, 'SELECT 1;'); }, (o) => o.code !== 0);
  record('B53', 'rotated A credential stays A only', 'new A credential through broker', 'A identity and A row', (c) => { const l=leaseA(c); return broker.execute(l,makeContext({userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c}),'SELECT session_user,label FROM proof.records;'); }, (o) => o.sessionUser === tenantA && o.stdout === `${tenantA}|record-a`);
  record('B54', 'PostgreSQL session user A remains A', 'A broker lease', 'A session_user', (c) => { const l=leaseA(c); return broker.execute(l,makeContext({userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c}),'SELECT session_user;'); }, (o) => o.sessionUser === tenantA && o.stdout === tenantA);
  record('B55', 'PostgreSQL session user B remains B', 'B broker lease', 'B session_user', (c) => { const l=leaseB(c); return broker.execute(l,makeContext({userId:userB,organizationId:organizationB,membershipId:membershipB,correlationId:c}),'SELECT session_user;'); }, (o) => o.sessionUser === tenantB && o.stdout === tenantB);
  record('B56', 'SET ROLE A to B denied', 'A direct SQL', 'deny', () => authority.directAuditQuery('cred-a', `SET ROLE ${tenantB};`), (o) => o.code !== 0);
  record('B57', 'SET ROLE B to A denied', 'B direct SQL', 'deny', () => sqlAs(tenantB, passwordB, `SET ROLE ${tenantA};`), (o) => o.code !== 0);
  record('B58', 'SET SESSION AUTHORIZATION A to B denied', 'A direct SQL with current A credential', 'deny', () => authority.directAuditQuery('cred-a', `SET SESSION AUTHORIZATION ${tenantB};`), (o) => o.code !== 0);
  record('B59', 'raw GUC cannot change A identity', 'A raw GUC B', 'foreign zero', (c) => { const l=leaseA(c); return broker.execute(l,makeContext({userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c}),`BEGIN; SELECT set_config('app.organization_id','${organizationB}',true); SELECT count(*) FROM proof.records WHERE organization_id='${organizationB}'; ROLLBACK;`); }, (o) => o.stdout.split('\n').includes('0') && o.sessionUser === tenantA);
  record('B60', 'forged organization cannot change session mapping', 'A context with B payload', 'DENY organization spoof', (c) => broker.issueLease(makeContext({userId:userA,organizationId:organizationA,membershipId:membershipA,correlationId:c}), { organizationId: organizationB }), (o) => o.error === 'ORGANIZATION_SPOOF');

  const toPayload = (coverage, cleanup) => ({
    status: coverage.status === 'PASS' ? 'PASS_BROKER_AUDIT_PROOF' : coverage.status,
    startedAt, finishedAt: new Date().toISOString(), databaseAlias: database, postgresVersion: adminSql('SHOW server_version;'), evidence, auditLog,
    mandatoryIds: coverage.mandatoryIds, executedIds: coverage.executedIds, missingIds: coverage.missingIds, duplicateIds: coverage.duplicateIds, unregisteredIds: coverage.unregisteredIds, invalidIds: coverage.invalidIds, testsWithoutResult: coverage.testsWithoutResult, evidenceMissingFields: coverage.evidenceMissingFields, expectedActualMismatchIds: coverage.expectedActualMismatchIds, hardFailures: coverage.hardFailures, coverageFailures: coverage.coverageFailures, securityFailures: coverage.hardFailures, cleanupFailures: coverage.cleanupFailures, cleanup, evidenceComplete: coverage.status === 'PASS', notProven: ['production workload identity separation', 'production credential authority/KMS ownership', 'provider HA/DR and scale', 'production broker deployment'],
  });
  const preCleanupCoverage = validateBrokerCoverage(evidence);
  const payload = toPayload(preCleanupCoverage, { ok: null, state: 'PENDING' });
  writeFileSync(auditFile, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  payload.cleanup = cleanupAuditResources();
  const finalCoverage = validateBrokerCoverage(evidence, { cleanup: payload.cleanup });
  Object.assign(payload, toPayload(finalCoverage, payload.cleanup));
  writeFileSync(auditFile, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  chmodSync(auditFile, 0o600);
  process.stdout.write(`${JSON.stringify({ status: payload.status, evidenceFile: auditFile, databaseAlias: database, hardFailures: finalCoverage.hardFailures, coverageFailures: finalCoverage.coverageFailures, cleanupFailures: finalCoverage.cleanupFailures }, null, 2)}\n`);
  process.exitCode = payload.status === 'PASS_BROKER_AUDIT_PROOF' ? 0 : 2;
}

main().catch((error) => {
  const cleanup = cleanupAuditResources();
  const payload = { status: cleanup.ok ? 'FAIL_SETUP_OR_HARNESS' : 'FAIL_CLEANUP', startedAt, finishedAt: new Date().toISOString(), databaseAlias: database, error: 'REDACTED_HARNESS_ERROR', errorCode: classifyHarnessError(error), evidence: [], evidenceComplete: false, cleanup, cleanupFailures: cleanup.ok ? [] : ['AUDIT_CLEANUP_FAILED'] };
  writeFileSync(auditFile, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  process.stderr.write(`Broker proof failed; redacted evidence: ${auditFile}\n`);
  process.exitCode = 2;
});

installSignalCleanup();
