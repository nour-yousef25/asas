import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, writeFileSync } from 'node:fs';

const suffix = `${Date.now()}_${process.pid}`;
const database = `asas_hybrid_identity_audit_${suffix}`;
const dbOwner = `hybrid_db_owner_${suffix}`;
const securityOwner = `hybrid_security_owner_${suffix}`;
const dataRole = `hybrid_tenant_data_${suffix}`;
const tenantA = `hybrid_tenant_a_${suffix}`;
const tenantB = `hybrid_tenant_b_${suffix}`;
const unauthenticated = `hybrid_unauth_${suffix}`;
const auditFile = `/tmp/w02-rls-hybrid-identity-evidence-${suffix}.json`;
const organizationA = '11111111-1111-4111-8111-111111111111';
const organizationB = '22222222-2222-4222-8222-222222222222';
const passwordA = randomBytes(30).toString('base64url');
const passwordB = randomBytes(30).toString('base64url');
const passwordUnauthenticated = randomBytes(30).toString('base64url');
const results = [];
const startedAt = new Date().toISOString();
let cleanupState = null;

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', ...options });
}

function adminSql(sql, db = 'postgres') {
  const outcome = run('sudo', ['-u', 'postgres', 'psql', '-d', db, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql]);
  if (outcome.status !== 0) throw new Error(outcome.stderr.trim() || outcome.stdout.trim());
  return outcome.stdout.trim();
}

function tenantSql(role, password, sql) {
  const outcome = run('psql', ['-h', '127.0.0.1', '-d', database, '-U', role, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', `SELECT 'META:' || pg_backend_pid() || ':' || coalesce(txid_current_if_assigned()::text, 'none'); ${sql}`], {
    env: { ...process.env, PGPASSWORD: password },
  });
  const lines = outcome.stdout.trim().split('\n');
  const meta = lines.shift() || '';
  const [, backendPid = 'unknown', transactionId = 'none'] = meta.match(/^META:([^:]+):(.*)$/) || [];
  return { code: outcome.status, principal: role, backendPid, transactionId, stdout: lines.join('\n').trim(), stderr: outcome.stderr.trim() };
}

function tenantSqlAsync(role, password, sql) {
  return new Promise((resolve) => {
    const child = spawn('psql', ['-h', '127.0.0.1', '-d', database, '-U', role, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', `SELECT 'META:' || pg_backend_pid() || ':' || coalesce(txid_current_if_assigned()::text, 'none'); ${sql}`], { env: { ...globalThis.process.env, PGPASSWORD: password } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => {
      const lines = stdout.trim().split('\n');
      const meta = lines.shift() || '';
      const [, backendPid = 'unknown', transactionId = 'none'] = meta.match(/^META:([^:]+):(.*)$/) || [];
      resolve({ code, principal: role, backendPid, transactionId, stdout: lines.join('\n').trim(), stderr: stderr.trim() });
    });
  });
}

function tenantScript(role, password, commands) {
  const script = [`SELECT 'META:' || pg_backend_pid() || ':' || coalesce(txid_current_if_assigned()::text, 'none');`, ...commands].join('\n');
  const outcome = run('psql', ['-h', '127.0.0.1', '-d', database, '-U', role, '-X', '-v', 'ON_ERROR_STOP=1', '-At'], {
    env: { ...process.env, PGPASSWORD: password },
    input: script,
  });
  const lines = outcome.stdout.trim().split('\n');
  const meta = lines.shift() || '';
  const [, backendPid = 'unknown', transactionId = 'none'] = meta.match(/^META:([^:]+):(.*)$/) || [];
  return { code: outcome.status, principal: role, backendPid, transactionId, stdout: lines.join('\n').trim(), stderr: outcome.stderr.trim() };
}

function tenantScriptContinue(role, password, commands) {
  const script = [`SELECT 'META:' || pg_backend_pid() || ':' || coalesce(txid_current_if_assigned()::text, 'none');`, ...commands].join('\n');
  const outcome = run('psql', ['-h', '127.0.0.1', '-d', database, '-U', role, '-X', '-At'], {
    env: { ...process.env, PGPASSWORD: password },
    input: script,
  });
  const lines = outcome.stdout.trim().split('\n');
  const meta = lines.shift() || '';
  const [, backendPid = 'unknown', transactionId = 'none'] = meta.match(/^META:([^:]+):(.*)$/) || [];
  return { code: outcome.status, principal: role, backendPid, transactionId, stdout: lines.join('\n').trim(), stderr: outcome.stderr.trim() };
}

function record(id, expected, actual, pass, detail = '') {
  results.push({ id, expected, actual, pass, detail, timestamp: new Date().toISOString() });
}

function expectSuccess(id, expected, operation, predicate = (out) => out.code === 0) {
  const out = operation();
  record(id, expected, out.code === 0 ? out.stdout : out.stderr, predicate(out), `principal=${out.principal || 'n/a'} pid=${out.backendPid || 'n/a'} xid=${out.transactionId || 'n/a'} exit=${out.code}`);
}

function expectFailure(id, expected, operation, predicate = (out) => out.code !== 0) {
  const out = operation();
  record(id, expected, out.code === 0 ? out.stdout : out.stderr, predicate(out), `principal=${out.principal || 'n/a'} pid=${out.backendPid || 'n/a'} xid=${out.transactionId || 'n/a'} exit=${out.code}`);
}

function setup() {
  adminSql(`CREATE ROLE ${dbOwner} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;`);
  adminSql(`CREATE ROLE ${securityOwner} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;`);
  adminSql(`CREATE ROLE ${dataRole} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;`);
  adminSql(`CREATE ROLE ${tenantA} LOGIN NOINHERIT NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION PASSWORD '${passwordA}';`);
  adminSql(`CREATE ROLE ${tenantB} LOGIN NOINHERIT NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION PASSWORD '${passwordB}';`);
  adminSql(`CREATE ROLE ${unauthenticated} LOGIN NOINHERIT NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION PASSWORD '${passwordUnauthenticated}';`);
  adminSql(`GRANT ${dataRole} TO ${tenantA} WITH INHERIT TRUE, SET FALSE;`);
  adminSql(`GRANT ${dataRole} TO ${tenantB} WITH INHERIT TRUE, SET FALSE;`);
  adminSql(`CREATE DATABASE ${database} OWNER ${dbOwner};`);

  const sql = `
REVOKE ALL ON DATABASE ${database} FROM PUBLIC;
GRANT CONNECT ON DATABASE ${database} TO ${tenantA}, ${tenantB}, ${unauthenticated};
CREATE SCHEMA proof AUTHORIZATION ${dbOwner};
CREATE SCHEMA security AUTHORIZATION ${securityOwner};
REVOKE ALL ON SCHEMA proof FROM PUBLIC;
REVOKE ALL ON SCHEMA security FROM PUBLIC;
GRANT USAGE ON SCHEMA proof TO ${dataRole};
GRANT USAGE ON SCHEMA security TO ${dataRole};
SET ROLE ${securityOwner};
CREATE TABLE security.role_organization (
  role_oid oid PRIMARY KEY,
  organization_id uuid NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true
);
INSERT INTO security.role_organization(role_oid, organization_id) VALUES
  ('${tenantA}'::regrole::oid, '${organizationA}'::uuid),
  ('${tenantB}'::regrole::oid, '${organizationB}'::uuid);
CREATE FUNCTION security.current_organization() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, security
AS $$ SELECT organization_id FROM security.role_organization WHERE role_oid = session_user::regrole::oid AND active $$;
REVOKE ALL ON TABLE security.role_organization FROM PUBLIC;
REVOKE ALL ON FUNCTION security.current_organization() FROM PUBLIC;
GRANT USAGE ON SCHEMA security TO ${dbOwner};
GRANT EXECUTE ON FUNCTION security.current_organization() TO ${dataRole};
RESET ROLE;
SET ROLE ${dbOwner};
CREATE TABLE proof.records (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  label text NOT NULL
);
CREATE TABLE proof.record_children (
  id uuid PRIMARY KEY,
  record_id uuid NOT NULL REFERENCES proof.records(id),
  organization_id uuid NOT NULL,
  label text NOT NULL
);
INSERT INTO proof.records VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '${organizationA}', 'record-a'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '${organizationB}', 'record-b');
INSERT INTO proof.record_children VALUES
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '${organizationA}', 'child-a'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '${organizationB}', 'child-b');
GRANT SELECT, INSERT, UPDATE, DELETE ON proof.records, proof.record_children TO ${dataRole};
ALTER TABLE proof.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE proof.record_children ENABLE ROW LEVEL SECURITY;
CREATE POLICY proof_records_tenant ON proof.records FOR ALL TO ${dataRole}
  USING (organization_id = security.current_organization())
  WITH CHECK (organization_id = security.current_organization());
CREATE POLICY proof_children_tenant ON proof.record_children FOR ALL TO ${dataRole}
  USING (organization_id = security.current_organization())
  WITH CHECK (organization_id = security.current_organization());
ALTER TABLE proof.records FORCE ROW LEVEL SECURITY;
ALTER TABLE proof.record_children FORCE ROW LEVEL SECURITY;
RESET ROLE;
`;
  const outcome = run('sudo', ['-u', 'postgres', 'psql', '-d', database, '-X', '-v', 'ON_ERROR_STOP=1'], { input: sql });
  if (outcome.status !== 0) throw new Error(outcome.stderr.trim() || outcome.stdout.trim());
}

function cleanupAuditResources() {
  const errors = [];
  const roles = [tenantA, tenantB, unauthenticated, dataRole, securityOwner, dbOwner];
  try { adminSql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${database}' AND pid <> pg_backend_pid();`); } catch (error) { errors.push(`TERMINATE:${error.message}`); }
  try { adminSql(`DROP DATABASE IF EXISTS ${database};`); } catch (error) { errors.push(`DROP_DATABASE:${error.message}`); }
  for (const role of roles) {
    try { adminSql(`DROP ROLE IF EXISTS ${role};`); } catch (error) { errors.push(`DROP_ROLE:${role}:${error.message}`); }
  }
  let residualDatabases = [];
  let residualRoles = [];
  try { residualDatabases = adminSql(`SELECT datname FROM pg_database WHERE datname='${database}';`).split('\n').filter(Boolean); } catch (error) { errors.push(`VERIFY_DATABASE:${error.message}`); }
  try { residualRoles = adminSql(`SELECT rolname FROM pg_roles WHERE rolname IN (${roles.map((role) => `'${role}'`).join(',')}) ORDER BY rolname;`).split('\n').filter(Boolean); } catch (error) { errors.push(`VERIFY_ROLES:${error.message}`); }
  return { ok: errors.length === 0 && residualDatabases.length === 0 && residualRoles.length === 0, residualDatabases, residualRoles, errors };
}

function cleanupOnce() {
  if (!cleanupState) cleanupState = cleanupAuditResources();
  return cleanupState;
}

function writeRedactedEvidence(payload) {
  writeFileSync(auditFile, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  chmodSync(auditFile, 0o600);
}

function installSignalCleanup() {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      const cleanup = cleanupOnce();
      try {
        writeRedactedEvidence({ status: cleanup.ok ? 'FAIL_INTERRUPTED' : 'FAIL_CLEANUP', startedAt, finishedAt: new Date().toISOString(), databaseAlias: database, interruption: signal, cleanup });
      } catch {}
      process.stderr.write(`Hybrid identity proof interrupted; redacted evidence: ${auditFile}\n`);
      process.exit(2);
    });
  }
}

async function main() {
  try {
    setup();
    if (process.env.W02_HYGIENE_FORCE_EXCEPTION === '1') throw new Error('HYGIENE_INJECTED_EXCEPTION');
    if (process.env.W02_HYGIENE_SELF_INTERRUPT === '1') {
      process.kill(process.pid, 'SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 25));
      return;
    }
  expectFailure('T01', 'no tenant login has no table access', () => tenantSql(unauthenticated, passwordUnauthenticated, 'SELECT label FROM proof.records;'));
  expectSuccess('T02', 'tenant A reads only A', () => tenantSql(tenantA, passwordA, "SELECT session_user, label FROM proof.records ORDER BY label;"), (o) => o.code === 0 && o.stdout === `${tenantA}|record-a`);
  expectSuccess('T03', 'tenant B reads only B', () => tenantSql(tenantB, passwordB, "SELECT session_user, label FROM proof.records ORDER BY label;"), (o) => o.code === 0 && o.stdout === `${tenantB}|record-b`);
  expectSuccess('T04', 'tenant A cannot read B', () => tenantSql(tenantA, passwordA, `SELECT count(*) FROM proof.records WHERE organization_id='${organizationB}';`), (o) => o.code === 0 && o.stdout === '0');
  expectSuccess('T05', 'tenant B cannot read A', () => tenantSql(tenantB, passwordB, `SELECT count(*) FROM proof.records WHERE organization_id='${organizationA}';`), (o) => o.code === 0 && o.stdout === '0');
  expectFailure('T06', 'A SET ROLE B denied', () => tenantSql(tenantA, passwordA, `BEGIN; SET ROLE ${tenantB};`));
  expectFailure('T07', 'B SET ROLE A denied', () => tenantSql(tenantB, passwordB, `BEGIN; SET ROLE ${tenantA};`));
  expectFailure('T08', 'A SET SESSION AUTHORIZATION B denied', () => tenantSql(tenantA, passwordA, `SET SESSION AUTHORIZATION ${tenantB};`));
  expectFailure('T08B', 'B SET SESSION AUTHORIZATION A denied', () => tenantSql(tenantB, passwordB, `SET SESSION AUTHORIZATION ${tenantA};`));
  expectSuccess('T09', 'A raw GUC has no effect', () => tenantSql(tenantA, passwordA, `BEGIN; SELECT set_config('app.organization_id','${organizationB}',true); SELECT count(*) FROM proof.records WHERE organization_id='${organizationB}'; ROLLBACK;`), (o) => o.code === 0 && o.stdout.split('\n').includes('0'));
  expectSuccess('T10', 'B raw GUC has no effect', () => tenantSql(tenantB, passwordB, `BEGIN; SELECT set_config('app.organization_id','${organizationA}',true); SELECT count(*) FROM proof.records WHERE organization_id='${organizationA}'; ROLLBACK;`), (o) => o.code === 0 && o.stdout.split('\n').includes('0'));
  expectSuccess('T11', 'forged B identifier does not change A', () => tenantSql(tenantA, passwordA, `SELECT session_user, security.current_organization(), '${organizationB}'::uuid;`), (o) => o.code === 0 && o.stdout.startsWith(`${tenantA}|${organizationA}|${organizationB}`));
  expectSuccess('T12', 'forged A identifier does not change B', () => tenantSql(tenantB, passwordB, `SELECT session_user, security.current_organization(), '${organizationA}'::uuid;`), (o) => o.code === 0 && o.stdout.startsWith(`${tenantB}|${organizationB}|${organizationA}`));
  expectSuccess('T32', 'A to B switch attempts inside one transaction deny', () => tenantScriptContinue(tenantA, passwordA, [
    'BEGIN;',
    'SAVEPOINT attempt_set_role;',
    `SET ROLE ${tenantB};`,
    'ROLLBACK TO SAVEPOINT attempt_set_role;',
    'SAVEPOINT attempt_session_authorization;',
    `SET SESSION AUTHORIZATION ${tenantB};`,
    'ROLLBACK TO SAVEPOINT attempt_session_authorization;',
    `SELECT set_config('app.organization_id','${organizationB}',true);`,
    `SELECT count(*) FROM proof.records WHERE organization_id='${organizationB}';`,
    'ROLLBACK;',
  ]), (o) => o.stdout.split('\n').includes('0') && o.stderr.includes('permission denied'));
  expectSuccess('T33', 'B to A switch attempts inside one transaction deny', () => tenantScriptContinue(tenantB, passwordB, [
    'BEGIN;',
    'SAVEPOINT attempt_set_role;',
    `SET ROLE ${tenantA};`,
    'ROLLBACK TO SAVEPOINT attempt_set_role;',
    'SAVEPOINT attempt_session_authorization;',
    `SET SESSION AUTHORIZATION ${tenantA};`,
    'ROLLBACK TO SAVEPOINT attempt_session_authorization;',
    `SELECT set_config('app.organization_id','${organizationA}',true);`,
    `SELECT count(*) FROM proof.records WHERE organization_id='${organizationA}';`,
    'ROLLBACK;',
  ]), (o) => o.stdout.split('\n').includes('0') && o.stderr.includes('permission denied'));
  expectSuccess('T13', 'A update B affects zero', () => tenantSql(tenantA, passwordA, `UPDATE proof.records SET label='forged' WHERE organization_id='${organizationB}'; SELECT label FROM proof.records;`), (o) => o.code === 0 && o.stdout.endsWith('record-a'));
  expectSuccess('T14', 'A delete B affects zero', () => tenantSql(tenantA, passwordA, `DELETE FROM proof.records WHERE organization_id='${organizationB}'; SELECT count(*) FROM proof.records;`), (o) => o.code === 0 && o.stdout.endsWith('1'));
  expectFailure('T15', 'A insert B denied', () => tenantSql(tenantA, passwordA, `INSERT INTO proof.records VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','${organizationB}','forged-b');`));
  expectSuccess('T16', 'A child B denied', () => tenantSql(tenantA, passwordA, `SELECT count(*) FROM proof.record_children WHERE organization_id='${organizationB}';`), (o) => o.code === 0 && o.stdout === '0');
  expectSuccess('T17', 'A direct join cannot expose B', () => tenantSql(tenantA, passwordA, `SELECT count(*) FROM proof.records r JOIN proof.record_children c ON c.record_id=r.id WHERE r.organization_id='${organizationB}';`), (o) => o.code === 0 && o.stdout === '0');
  expectSuccess('T18', 'rollback has no identity leakage', () => tenantSql(tenantA, passwordA, `BEGIN; SELECT set_config('app.organization_id','${organizationB}',true); ROLLBACK; SELECT session_user, security.current_organization();`), (o) => o.code === 0 && o.stdout.split('\n').includes(`${tenantA}|${organizationA}`));
  expectSuccess('T19', 'DISCARD ALL preserves same tenant principal', () => tenantScript(tenantA, passwordA, ['SELECT session_user;', 'DISCARD ALL;', 'SELECT session_user;']), (o) => o.code === 0 && o.stdout.split('\n').filter((line) => line === tenantA).length === 2);
  const concurrentOutcomes = await Promise.all(Array.from({ length: 8 }, (_, i) => i % 2 === 0
    ? tenantSqlAsync(tenantA, passwordA, 'SELECT session_user, label FROM proof.records;')
    : tenantSqlAsync(tenantB, passwordB, 'SELECT session_user, label FROM proof.records;')));
  const concurrentPass = concurrentOutcomes.every((outcome) => outcome.code === 0 && outcome.stdout === `${outcome.principal}|${outcome.principal === tenantA ? 'record-a' : 'record-b'}`);
  record('T20', 'concurrent A/B have no cross-talk', concurrentOutcomes.map((outcome) => `${outcome.principal}:${outcome.stdout}`).join(','), concurrentPass, concurrentOutcomes.map((outcome) => `pid=${outcome.backendPid} xid=${outcome.transactionId}`).join(','));
  expectFailure('T21', 'revoked A credential/login denied', () => {
    adminSql(`ALTER ROLE ${tenantA} NOLOGIN;`);
    return tenantSql(tenantA, passwordA, 'SELECT 1;');
  });
  adminSql(`ALTER ROLE ${tenantA} LOGIN PASSWORD '${passwordA}' VALID UNTIL 'infinity';`);
  expectFailure('T22', 'expired A credential denied', () => {
    adminSql(`ALTER ROLE ${tenantA} VALID UNTIL 'epoch';`);
    return tenantSql(tenantA, passwordA, 'SELECT 1;');
  });
  adminSql(`ALTER ROLE ${tenantA} VALID UNTIL 'infinity';`);
  expectFailure('T24', 'credential authority failure denies', () => tenantSql(tenantA, 'incorrect-audit-password', 'SELECT 1;'));
  expectFailure('T25', 'wrong tenant role requested through SQL denied', () => tenantSql(tenantA, passwordA, `SET ROLE ${tenantB};`));
  expectFailure('T26', 'A cannot provision a tenant B principal', () => tenantSql(tenantA, passwordA, `CREATE ROLE forged_tenant_b_${suffix} LOGIN;`));
  expectSuccess('T27', 'A cannot use B role authority', () => tenantSql(tenantA, passwordA, `SELECT pg_has_role(session_user, '${tenantB}', 'SET'), pg_has_role(session_user, '${tenantB}', 'USAGE');`), (o) => o.code === 0 && o.stdout === 'f|f');
  expectFailure('T28', 'A cannot modify security map', () => tenantSql(tenantA, passwordA, `UPDATE security.role_organization SET active=false WHERE organization_id='${organizationB}';`));
  expectFailure('T29', 'A cannot modify memberships', () => tenantSql(tenantA, passwordA, `GRANT ${tenantB} TO ${tenantA};`));
  expectFailure('T30', 'A cannot create privileged role', () => tenantSql(tenantA, passwordA, `CREATE ROLE illegal_proof_role SUPERUSER;`));
  adminSql(`UPDATE security.role_organization SET active=false WHERE organization_id='${organizationA}';`, database);
  expectSuccess('T31', 'revoked secure role mapping denies A data', () => tenantSql(tenantA, passwordA, 'SELECT count(*) FROM proof.records;'), (o) => o.code === 0 && o.stdout === '0');
  adminSql(`UPDATE security.role_organization SET active=true WHERE organization_id='${organizationA}';`, database);

  const hardFailures = results.filter((r) => !r.pass).map((r) => r.id);
    if (process.env.W02_HYGIENE_FORCE_ASSERTION_FAILURE === '1') {
      record('HYG-ASSERT', 'controlled cleanup assertion path', 'injected assertion failure', false, 'HYGIENE_INJECTED_ASSERTION_FAILURE');
      hardFailures.push('HYG-ASSERT');
    }
    const evidence = {
    status: hardFailures.length === 0 ? 'PASS_DATABASE_IDENTITY_PROOF_PARTIAL' : 'FAIL',
    startedAt,
    finishedAt: new Date().toISOString(),
    databaseAlias: database,
    postgresVersion: adminSql('SHOW server_version;'),
    principals: { tenantA, tenantB, unauthenticated },
    results,
    hardFailures,
    limitations: ['T20 runs direct concurrent PostgreSQL connections in the harness but is summarized separately by the runner.', 'T23 broker unavailable is a contract gate only because no broker service is implemented in this proof.', 'Session, membership, and policy staleness require a broker/session authority integration and remain unproven.'],
  };
    evidence.cleanup = cleanupOnce();
    if (!evidence.cleanup.ok) evidence.status = 'FAIL_CLEANUP';
    writeRedactedEvidence(evidence);
    process.stdout.write(`${JSON.stringify({ status: evidence.status, evidenceFile: auditFile, databaseAlias: database, hardFailures, cleanupFailures: evidence.cleanup.errors }, null, 2)}\n`);
    process.exitCode = evidence.status === 'PASS_DATABASE_IDENTITY_PROOF_PARTIAL' ? 0 : 2;
  } catch (error) {
    const cleanup = cleanupOnce();
    const evidence = { status: cleanup.ok ? 'FAIL_SETUP_OR_HARNESS' : 'FAIL_CLEANUP', startedAt, finishedAt: new Date().toISOString(), databaseAlias: database, error: 'REDACTED_HARNESS_ERROR', cleanup };
    writeRedactedEvidence(evidence);
    process.stderr.write(`Hybrid identity proof failed; redacted evidence: ${auditFile}\n`);
    process.exitCode = 2;
  }
}

installSignalCleanup();
main();
