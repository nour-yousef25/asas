import { randomBytes, randomUUID } from "node:crypto";
import { chmodSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { BrokerDeniedError, TenantAccessBroker, type BrokerContext, type TenantCredentialAuthority } from "../src/lib/tenant-access-broker";

const suffix = `${Date.now()}_${process.pid}`;
const database = `asas_broker_lifecycle_audit_${suffix}`;
const migrator = `broker_lifecycle_migrator_${suffix}`;
const brokerApp = `broker_lifecycle_app_${suffix}`;
const tenantA = `broker_lifecycle_a_${suffix}`;
const tenantARotated = `${tenantA}_g2`;
const tenantB = `broker_lifecycle_b_${suffix}`;
const evidenceFile = `/tmp/w02-broker-lifecycle-evidence-${suffix}.json`;
const password = () => randomBytes(30).toString("base64url");
const passwords = { migrator: password(), brokerApp: password(), tenantA: password(), tenantARotated: password(), tenantB: password() };
const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";
const userA = "aaaaaaaa-0000-4000-8000-000000000001";
const userB = "bbbbbbbb-0000-4000-8000-000000000002";
const membershipA = "aaaaaaaa-0000-4000-8000-000000000101";
const membershipB = "bbbbbbbb-0000-4000-8000-000000000102";
const evidence: Array<Record<string, unknown>> = [];
const startedAt = new Date().toISOString();

function command(commandName: string, args: string[], options: Record<string, unknown> = {}) {
  return spawnSync(commandName, args, { encoding: "utf8", ...options });
}

function adminSql(sql: string, db = "postgres") {
  const out = command("sudo", ["-u", "postgres", "psql", "-d", db, "-X", "-v", "ON_ERROR_STOP=1", "-At"], { input: sql });
  if (out.status !== 0) throw new Error("AUDIT_ADMIN_SQL_FAILED");
  return out.stdout.trim();
}

function psqlAs(role: string, secret: string, sql: string) {
  const out = command("psql", ["-h", "127.0.0.1", "-d", database, "-U", role, "-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", sql], { env: { ...process.env, PGPASSWORD: secret } });
  if (out.status !== 0) throw new Error("TENANT_DATABASE_OPERATION_DENIED");
  return out.stdout.trim();
}

function context(input: { userId: string; organizationId: string; membershipId: string; correlationId: string; sessionVersion?: number; policySnapshotVersion?: number }): BrokerContext {
  return Object.freeze({ ...input, sessionVersion: input.sessionVersion ?? 1, policySnapshotVersion: input.policySnapshotVersion ?? 1 });
}

function writeEvidence(payload: Record<string, unknown>) {
  writeFileSync(evidenceFile, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  chmodSync(evidenceFile, 0o600);
}

function record(id: string, expected: string, action: () => Promise<unknown>, check: (value: unknown) => boolean) {
  return action().then(
    (actual) => evidence.push({ id, expected, actual: typeof actual === "string" ? actual : "REDACTED_OBJECT", result: check(actual) ? "PASS" : "FAIL", timestamp: new Date().toISOString(), environment: "disposable-postgresql-audit", cleanupStatus: "PENDING" }),
    (error: unknown) => {
      const code = error instanceof BrokerDeniedError ? error.code : "UNEXPECTED";
      evidence.push({ id, expected, actual: code, result: check({ error: code }) ? "PASS" : "FAIL", timestamp: new Date().toISOString(), environment: "disposable-postgresql-audit", cleanupStatus: "PENDING" });
    },
  );
}

function cleanup() {
  const roles = [tenantA, tenantARotated, tenantB, brokerApp, migrator];
  const errors: string[] = [];
  try { adminSql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${database}' AND pid <> pg_backend_pid();`); } catch { errors.push("TERMINATE_FAILED"); }
  try { adminSql(`DROP DATABASE IF EXISTS ${database};`); } catch { errors.push("DROP_DATABASE_FAILED"); }
  for (const role of roles) try { adminSql(`DROP ROLE IF EXISTS ${role};`); } catch { errors.push("DROP_ROLE_FAILED"); }
  let residue = "";
  try { residue = adminSql(`SELECT datname FROM pg_database WHERE datname='${database}' UNION ALL SELECT rolname FROM pg_roles WHERE rolname IN (${roles.map((role) => `'${role}'`).join(",")});`); } catch { errors.push("RESIDUE_SCAN_FAILED"); }
  return { ok: errors.length === 0 && residue === "", errors, residueCount: residue ? residue.split("\n").filter(Boolean).length : 0 };
}

async function main() {
  let prisma: PrismaClient | null = null;
  try {
    adminSql(`CREATE ROLE ${migrator} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords.migrator}'; CREATE DATABASE ${database} OWNER ${migrator}; CREATE ROLE ${brokerApp} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords.brokerApp}'; CREATE ROLE ${tenantA} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords.tenantA}'; CREATE ROLE ${tenantARotated} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords.tenantARotated}'; CREATE ROLE ${tenantB} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords.tenantB}';`);
    const migrationUrl = `postgresql://${migrator}:${passwords.migrator}@127.0.0.1:5432/${database}?schema=public`;
    const migration = command("./node_modules/.bin/prisma", ["migrate", "deploy", "--schema", "prisma/schema.prisma"], { env: { ...process.env, DATABASE_URL: migrationUrl } });
    if (migration.status !== 0) throw new Error("MIGRATION_DEPLOY_FAILED");
    adminSql(`GRANT CONNECT ON DATABASE ${database} TO ${brokerApp}, ${tenantA}, ${tenantARotated}, ${tenantB}; GRANT USAGE ON SCHEMA public TO ${brokerApp}; GRANT SELECT, INSERT, UPDATE ON TABLE "users", "organizations", "organization_memberships", "tenant_database_principals", "tenant_access_leases", "tenant_broker_audit_events" TO ${brokerApp};`, database);
    adminSql(`INSERT INTO "organizations" ("id","name","createdAt","updatedAt") VALUES ('${orgA}','Organization A',now(),now()),('${orgB}','Organization B',now(),now()); INSERT INTO "users" ("id","name","email","role","isActive","authVersion","activeOrganizationId","createdAt","updatedAt") VALUES ('${userA}','User A','a-${suffix}@audit.invalid','MEMBER',true,1,'${orgA}',now(),now()),('${userB}','User B','b-${suffix}@audit.invalid','MEMBER',true,1,'${orgB}',now(),now()); INSERT INTO "organization_memberships" ("id","organizationId","userId","role","isActive","policyVersion","createdAt","updatedAt") VALUES ('${membershipA}','${orgA}','${userA}','MEMBER',true,1,now(),now()),('${membershipB}','${orgB}','${userB}','MEMBER',true,1,now(),now()); INSERT INTO "tenant_database_principals" ("id","organizationId","principalName","credentialReference","generation","status","activatedAt","createdAt","updatedAt") VALUES ('principal-a','${orgA}','${tenantA}','audit://principal-a/1',1,'ACTIVE',now(),now(),now()),('principal-b','${orgB}','${tenantB}','audit://principal-b/1',1,'ACTIVE',now(),now(),now()); CREATE TABLE public.broker_runtime_records (id text primary key, organization_id text not null, label text not null); INSERT INTO public.broker_runtime_records VALUES ('record-a','${orgA}','A'),('record-b','${orgB}','B'); CREATE TABLE public.broker_runtime_role_map (role_name name primary key, organization_id text not null); INSERT INTO public.broker_runtime_role_map VALUES ('${tenantA}','${orgA}'),('${tenantARotated}','${orgA}'),('${tenantB}','${orgB}'); CREATE FUNCTION public.broker_runtime_org() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$ SELECT organization_id FROM public.broker_runtime_role_map WHERE role_name = session_user::name $$; REVOKE ALL ON public.broker_runtime_records, public.broker_runtime_role_map FROM PUBLIC; REVOKE ALL ON FUNCTION public.broker_runtime_org() FROM PUBLIC; GRANT SELECT ON public.broker_runtime_records TO ${tenantA}, ${tenantARotated}, ${tenantB}; GRANT EXECUTE ON FUNCTION public.broker_runtime_org() TO ${tenantA}, ${tenantARotated}, ${tenantB}; ALTER TABLE public.broker_runtime_records ENABLE ROW LEVEL SECURITY; ALTER TABLE public.broker_runtime_records FORCE ROW LEVEL SECURITY; CREATE POLICY broker_runtime_isolation ON public.broker_runtime_records FOR SELECT TO ${tenantA}, ${tenantARotated}, ${tenantB} USING (organization_id = public.broker_runtime_org());`, database);
    prisma = new PrismaClient({ datasources: { db: { url: `postgresql://${brokerApp}:${passwords.brokerApp}@127.0.0.1:5432/${database}?schema=public` } } });
    const probes = new Map<string, string>();
    const authority: TenantCredentialAuthority = {
      async run(input, operation) {
        const secret = input.principalName === tenantA ? passwords.tenantA : input.principalName === tenantARotated ? passwords.tenantARotated : input.principalName === tenantB ? passwords.tenantB : undefined;
        if (!secret) throw new Error("AUTHORITY_MAPPING_MISSING");
        const result = psqlAs(input.principalName, secret, "SELECT session_user || '|' || count(*) FROM public.broker_runtime_records WHERE organization_id <> public.broker_runtime_org();");
        if (!result.startsWith(`${input.principalName}|0`)) throw new Error("DATABASE_IDENTITY_OR_RLS_MISMATCH");
        probes.set(input.connectionId, result);
        return operation(input);
      },
    };
    const broker = new TenantAccessBroker(prisma, authority, 5_000);
    const contextA = context({ userId: userA, organizationId: orgA, membershipId: membershipA, correlationId: "corr-a" });
    const contextB = context({ userId: userB, organizationId: orgB, membershipId: membershipB, correlationId: "corr-b" });
    const leaseA = await broker.issueLease(contextA);
    const leaseB = await broker.issueLease(contextB);
    await record("L01", "A lease executes only as tenant A and sees zero foreign rows", () => broker.execute(contextA, leaseA, async ({ connectionId }) => probes.get(connectionId)), (actual) => actual === `${tenantA}|0`);
    await record("L02", "B lease executes only as tenant B and sees zero foreign rows", () => broker.execute(contextB, leaseB, async ({ connectionId }) => probes.get(connectionId)), (actual) => actual === `${tenantB}|0`);
    await record("L03", "A/B leases use different connection partitions", async () => leaseA.connectionId !== leaseB.connectionId, (actual) => actual === true);
    const leaseForContextAttack = await broker.issueLease(contextA);
    await record("L04", "A lease with B context is denied before authority", () => broker.execute(contextB, leaseForContextAttack, async () => "unexpected"), (actual) => typeof actual === "object" && (actual as { error: string }).error === "LEASE_CONNECTION_OR_CORRELATION_MISMATCH");
    await record("L05", "lease replay is denied", () => broker.execute(contextA, leaseA, async () => "unexpected"), (actual) => typeof actual === "object" && (actual as { error: string }).error === "LEASE_REPLAY");
    await prisma.user.update({ where: { id: userA }, data: { authVersion: 2 } });
    await record("L06", "stale session blocks new lease", () => broker.issueLease(contextA), (actual) => typeof actual === "object" && (actual as { error: string }).error === "STALE_SESSION");
    await prisma.user.update({ where: { id: userA }, data: { authVersion: 1 } });
    await prisma.organizationMembership.update({ where: { id: membershipA }, data: { policyVersion: 2 } });
    await record("L07", "stale policy blocks new lease", () => broker.issueLease(contextA), (actual) => typeof actual === "object" && (actual as { error: string }).error === "STALE_POLICY");
    await prisma.organizationMembership.update({ where: { id: membershipA }, data: { policyVersion: 1 } });
    await broker.revokePrincipal("principal-a", "corr-revoke");
    await record("L08", "principal revocation blocks new A lease", () => broker.issueLease(contextA), (actual) => typeof actual === "object" && (actual as { error: string }).error === "PRINCIPAL_MAPPING_ABSENT");
    await prisma.tenantDatabasePrincipal.create({ data: { organizationId: orgA, principalName: tenantARotated, credentialReference: "audit://principal-a/2", generation: 2 } });
    const leaseRotated = await broker.issueLease(contextA);
    await record("L09", "rotation selects and executes only new active principal", () => broker.execute(contextA, leaseRotated, async ({ connectionId }) => probes.get(connectionId)), (actual) => actual === `${tenantARotated}|0`);
    const unavailableLease = await broker.issueLease(contextB);
    const unavailableBroker = new TenantAccessBroker(prisma, { run: async () => { throw new Error("authority unavailable"); } }, 5_000);
    await record("L10", "authority uncertainty fails closed", () => unavailableBroker.execute(contextB, unavailableLease, async () => "unexpected"), (actual) => typeof actual === "object" && (actual as { error: string }).error === "AUTHORITY_OR_OPERATION_FAILURE");
    const hardFailures = evidence.filter((item) => item.result !== "PASS").map((item) => item.id);
    const cleanupState = { ok: false, errors: ["PENDING"], residueCount: -1 };
    const payload: Record<string, unknown> = { status: hardFailures.length === 0 ? "PASS_BROKER_LIFECYCLE_RUNTIME_PROOF" : "FAIL", startedAt, finishedAt: new Date().toISOString(), databaseAlias: database, environment: "disposable-postgresql-audit", mandatoryIds: ["L01", "L02", "L03", "L04", "L05", "L06", "L07", "L08", "L09", "L10"], evidence, hardFailures, cleanup: cleanupState, credentialsPersisted: false, productionResourcesTouched: false };
    await prisma.$disconnect(); prisma = null;
    const finalCleanup = cleanup();
    payload.cleanup = finalCleanup;
    if (!finalCleanup.ok) payload.status = "FAIL_CLEANUP";
    for (const item of evidence) item.cleanupStatus = finalCleanup.ok ? "PASS" : "FAIL";
    writeEvidence(payload);
    process.stdout.write(`${JSON.stringify({ status: payload.status, evidenceFile, hardFailures, cleanup: finalCleanup }, null, 2)}\n`);
    process.exitCode = payload.status === "PASS_BROKER_LIFECYCLE_RUNTIME_PROOF" ? 0 : 2;
  } catch {
    if (prisma) await prisma.$disconnect().catch(() => undefined);
    const finalCleanup = cleanup();
    writeEvidence({ status: finalCleanup.ok ? "FAIL_SETUP_OR_HARNESS" : "FAIL_CLEANUP", startedAt, finishedAt: new Date().toISOString(), databaseAlias: database, error: "REDACTED_HARNESS_ERROR", cleanup: finalCleanup, credentialsPersisted: false, productionResourcesTouched: false });
    process.stderr.write(`Broker lifecycle runtime proof failed; redacted evidence: ${evidenceFile}\n`);
    process.exitCode = 2;
  }
}

void main();
