import { randomBytes } from "node:crypto";
import { chmodSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { BeneficiaryRepository } from "../src/lib/beneficiary-repository";
import type { TenantContext } from "../src/lib/tenant-context";

const suffix = `${Date.now()}_${process.pid}`;
const database = `asas_beneficiary_ownership_audit_${suffix}`;
const migrator = `beneficiary_migrator_${suffix}`;
const appRole = `beneficiary_app_${suffix}`;
const evidenceFile = `/tmp/w02-beneficiary-ownership-evidence-${suffix}.json`;
const randomPassword = () => randomBytes(30).toString("base64url");
const passwords = { migrator: randomPassword(), appRole: randomPassword() };
const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";
const userA = "aaaaaaaa-0000-4000-8000-000000000001";
const userB = "bbbbbbbb-0000-4000-8000-000000000002";
const membershipA = "aaaaaaaa-0000-4000-8000-000000000101";
const membershipB = "bbbbbbbb-0000-4000-8000-000000000102";
const evidence: Array<Record<string, unknown>> = [];

function run(command: string, args: string[], options: Record<string, unknown> = {}) { return spawnSync(command, args, { encoding: "utf8", ...options }); }
function adminSql(sql: string, db = "postgres") { const out = run("sudo", ["-u", "postgres", "psql", "-d", db, "-X", "-v", "ON_ERROR_STOP=1", "-At"], { input: sql }); if (out.status !== 0) throw new Error("AUDIT_ADMIN_SQL_FAILED"); return out.stdout.trim(); }
function writeEvidence(payload: Record<string, unknown>) { writeFileSync(evidenceFile, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 }); chmodSync(evidenceFile, 0o600); }
function context(input: { organizationId: string; userId: string; membershipId: string; correlationId: string }): TenantContext { return Object.freeze({ ...input, policySnapshotVersion: 1 }); }
async function record(id: string, expected: string, action: () => Promise<unknown>, check: (actual: unknown) => boolean) { try { const actual = await action(); evidence.push({ id, expected, actual: typeof actual === "string" || typeof actual === "boolean" || typeof actual === "number" ? actual : "REDACTED_OBJECT", result: check(actual) ? "PASS" : "FAIL", timestamp: new Date().toISOString(), environment: "disposable-postgresql-audit", cleanupStatus: "PENDING" }); } catch { evidence.push({ id, expected, actual: "REDACTED_EXCEPTION", result: "FAIL", timestamp: new Date().toISOString(), environment: "disposable-postgresql-audit", cleanupStatus: "PENDING" }); } }
function cleanup() { const roles = [appRole, migrator]; const errors: string[] = []; try { adminSql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${database}' AND pid <> pg_backend_pid();`); } catch { errors.push("TERMINATE_FAILED"); } try { adminSql(`DROP DATABASE IF EXISTS ${database};`); } catch { errors.push("DROP_DATABASE_FAILED"); } for (const role of roles) try { adminSql(`DROP ROLE IF EXISTS ${role};`); } catch { errors.push("DROP_ROLE_FAILED"); } let residue = ""; try { residue = adminSql(`SELECT datname FROM pg_database WHERE datname='${database}' UNION ALL SELECT rolname FROM pg_roles WHERE rolname IN (${roles.map((role) => `'${role}'`).join(",")});`); } catch { errors.push("RESIDUE_SCAN_FAILED"); } return { ok: errors.length === 0 && residue === "", errors, residueCount: residue ? residue.split("\n").filter(Boolean).length : 0 }; }

async function main() {
  let prisma: PrismaClient | null = null;
  const startedAt = new Date().toISOString();
  try {
    adminSql(`CREATE ROLE ${migrator} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords.migrator}'; CREATE DATABASE ${database} OWNER ${migrator}; CREATE ROLE ${appRole} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords.appRole}';`);
    const migrationUrl = `postgresql://${migrator}:${passwords.migrator}@127.0.0.1:5432/${database}?schema=public`;
    const migration = run("./node_modules/.bin/prisma", ["migrate", "deploy", "--schema", "prisma/schema.prisma"], { env: { ...process.env, DATABASE_URL: migrationUrl } });
    if (migration.status !== 0) throw new Error("MIGRATION_DEPLOY_FAILED");
    adminSql(`GRANT CONNECT ON DATABASE ${database} TO ${appRole}; GRANT USAGE ON SCHEMA public TO ${appRole}; GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "organizations", "users", "organization_memberships", "beneficiaries", "beneficiary_documents", "audit_logs" TO ${appRole};`, database);
    adminSql(`INSERT INTO "organizations" ("id","name","createdAt","updatedAt") VALUES ('${orgA}','Organization A',now(),now()),('${orgB}','Organization B',now(),now()); INSERT INTO "users" ("id","name","email","role","isActive","authVersion","activeOrganizationId","createdAt","updatedAt") VALUES ('${userA}','User A','a-${suffix}@audit.invalid','MEMBER',true,1,'${orgA}',now(),now()),('${userB}','User B','b-${suffix}@audit.invalid','MEMBER',true,1,'${orgB}',now(),now()); INSERT INTO "organization_memberships" ("id","organizationId","userId","role","isActive","policyVersion","createdAt","updatedAt") VALUES ('${membershipA}','${orgA}','${userA}','MEMBER',true,1,now(),now()),('${membershipB}','${orgB}','${userB}','MEMBER',true,1,now(),now()); INSERT INTO "beneficiaries" ("id","organizationId","name","phone","status","createdAt","updatedAt") VALUES ('beneficiary-a','${orgA}','Beneficiary A','0500000001','ACTIVE',now(),now()),('beneficiary-b','${orgB}','Beneficiary B','0500000002','ACTIVE',now(),now());`, database);
    prisma = new PrismaClient({ datasources: { db: { url: `postgresql://${appRole}:${passwords.appRole}@127.0.0.1:5432/${database}?schema=public` } } });
    const repository = new BeneficiaryRepository(prisma);
    const ctxA = context({ organizationId: orgA, userId: userA, membershipId: membershipA, correlationId: "beneficiary-corr-a" });
    await record("O01", "A list returns only A records", async () => (await repository.list(ctxA, { skip: 0, take: 50 })).data.map((item) => item.organizationId).join(","), (actual) => actual === orgA);
    await record("O02", "A cannot read B resource", async () => (await repository.getById(ctxA, "beneficiary-b")) === null, (actual) => actual === true);
    await record("O03", "A cannot update B resource", async () => (await repository.update(ctxA, "beneficiary-b", { name: "forbidden" })) === null, (actual) => actual === true);
    await record("O04", "A cannot delete B resource", () => repository.deleteOrArchive(ctxA, "beneficiary-b"), (actual) => actual === false);
    await record("O05", "create ignores forged organization owner", async () => (await repository.create(ctxA, { name: "New A", phone: "0500000003", status: "ACTIVE", organizationId: orgB } as any)).organizationId, (actual) => actual === orgA);
    await record("O06", "cross-tenant deny actions are audited with A correlation", async () => (await prisma!.auditLog.count({ where: { organizationId: orgA, action: { contains: "TENANT_BENEFICIARY" }, details: { path: ["correlationId"], equals: ctxA.correlationId } } })) >= 3, (actual) => actual === true);
    const hardFailures = evidence.filter((item) => item.result !== "PASS").map((item) => item.id);
    const payload: Record<string, unknown> = { status: hardFailures.length === 0 ? "PASS_BENEFICIARY_OWNERSHIP_RUNTIME_PROOF" : "FAIL", startedAt, finishedAt: new Date().toISOString(), databaseAlias: database, environment: "disposable-postgresql-audit", mandatoryIds: ["O01", "O02", "O03", "O04", "O05", "O06"], evidence, hardFailures, cleanup: { ok: false, residueCount: -1 }, credentialsPersisted: false, productionResourcesTouched: false };
    await prisma.$disconnect(); prisma = null; const finalCleanup = cleanup(); payload.cleanup = finalCleanup; if (!finalCleanup.ok) payload.status = "FAIL_CLEANUP"; for (const item of evidence) item.cleanupStatus = finalCleanup.ok ? "PASS" : "FAIL"; writeEvidence(payload); process.stdout.write(`${JSON.stringify({ status: payload.status, evidenceFile, hardFailures, cleanup: finalCleanup }, null, 2)}\n`); process.exitCode = payload.status === "PASS_BENEFICIARY_OWNERSHIP_RUNTIME_PROOF" ? 0 : 2;
  } catch { if (prisma) await prisma.$disconnect().catch(() => undefined); const finalCleanup = cleanup(); writeEvidence({ status: finalCleanup.ok ? "FAIL_SETUP_OR_HARNESS" : "FAIL_CLEANUP", startedAt, finishedAt: new Date().toISOString(), databaseAlias: database, error: "REDACTED_HARNESS_ERROR", cleanup: finalCleanup, credentialsPersisted: false, productionResourcesTouched: false }); process.stderr.write(`Beneficiary ownership proof failed; redacted evidence: ${evidenceFile}\n`); process.exitCode = 2; }
}
void main();
