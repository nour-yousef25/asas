import { randomBytes } from "node:crypto";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { BrokerDeniedError, TenantAccessBroker } from "../src/lib/tenant-access-broker";
import { TenantBoundPrismaCredentialAuthority, TenantBoundPrismaExecutor, type TenantConnectionProvider } from "../src/lib/tenant-bound-prisma-authority";
import { FinancialRepository, FinancialScopeError } from "../src/lib/financial-repository";
import type { TenantContext } from "../src/lib/tenant-context";

/**
 * W02 Financial donor/donation runtime evidence.
 *
 * Scope: disposable PostgreSQL only. The tenant identity chain is tenant LOGIN
 * principal -> session_user -> Broker lease -> tenant-bound Prisma. This proof
 * deliberately does not add or enable Financial RLS, and never reads a global
 * Prisma client or a deployment environment credential.
 */
const suffix = `${Date.now()}_${process.pid}`;
const database = `asas_financial_runtime_audit_${suffix}`;
const migrator = `financial_runtime_migrator_${suffix}`;
const controlRole = `financial_runtime_control_${suffix}`;
const tenantA1 = `financial_runtime_a1_${suffix}`;
const tenantA2 = `financial_runtime_a2_${suffix}`;
const tenantB1 = `financial_runtime_b1_${suffix}`;
const evidenceFile = `/tmp/w02-financial-runtime-evidence-${suffix}.json`;
const mandatoryIds = ["F01", "F02", "F03", "F04", "F05", "F06", "F07", "F08", "F09", "F10"];
const randomPassword = () => randomBytes(30).toString("base64url");
const passwords = { migrator: randomPassword(), control: randomPassword(), a1: randomPassword(), a2: randomPassword(), b1: randomPassword() };
const evidence: Array<Record<string, unknown>> = [];

const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";
const userA = "aaaaaaaa-0000-4000-8000-000000000001";
const userB = "bbbbbbbb-0000-4000-8000-000000000002";
const membershipA = "aaaaaaaa-0000-4000-8000-000000000101";
const membershipB = "bbbbbbbb-0000-4000-8000-000000000102";

function run(command: string, args: string[], options: Record<string, unknown> = {}) {
  return spawnSync(command, args, { encoding: "utf8", ...options });
}

function adminSql(sql: string, db = "postgres") {
  const output = run("sudo", ["-u", "postgres", "psql", "-d", db, "-X", "-v", "ON_ERROR_STOP=1", "-At"], { input: sql });
  if (output.status !== 0) throw new Error("AUDIT_ADMIN_SQL_FAILED");
  return output.stdout.trim();
}

function writeEvidence(payload: Record<string, unknown>) {
  writeFileSync(evidenceFile, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  chmodSync(evidenceFile, 0o600);
}

function context(input: { organizationId: string; userId: string; membershipId: string; correlationId: string; sessionVersion?: number }): TenantContext {
  return Object.freeze({ ...input, sessionVersion: input.sessionVersion ?? 1, policySnapshotVersion: 1 });
}

async function record(id: string, expected: string, action: () => Promise<unknown>, check: (actual: unknown) => boolean) {
  try {
    const actual = await action();
    evidence.push({
      id,
      expected,
      actual: typeof actual === "string" || typeof actual === "boolean" || typeof actual === "number" ? actual : "REDACTED_OBJECT",
      result: check(actual) ? "PASS" : "FAIL",
      timestamp: new Date().toISOString(),
      environment: "disposable-postgresql-audit",
      cleanupStatus: "PENDING",
    });
  } catch {
    evidence.push({ id, expected, actual: "REDACTED_EXCEPTION", result: "FAIL", timestamp: new Date().toISOString(), environment: "disposable-postgresql-audit", cleanupStatus: "PENDING" });
  }
}

async function brokerDenied(action: () => Promise<unknown>, code: string) {
  try {
    await action();
    return false;
  } catch (error) {
    return error instanceof BrokerDeniedError && error.code === code;
  }
}

async function forbiddenRelation(action: () => Promise<unknown>) {
  try {
    await action();
    return false;
  } catch (error) {
    return error instanceof FinancialScopeError && error.code === "FORBIDDEN_RELATION";
  }
}

function cleanup() {
  const roles = [tenantA1, tenantA2, tenantB1, controlRole, migrator];
  const errors: string[] = [];
  try { adminSql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${database}' AND pid <> pg_backend_pid();`); } catch { errors.push("TERMINATE_FAILED"); }
  try { adminSql(`DROP DATABASE IF EXISTS ${database};`); } catch { errors.push("DROP_DATABASE_FAILED"); }
  for (const role of roles) {
    try { adminSql(`DROP ROLE IF EXISTS ${role};`); } catch { errors.push("DROP_ROLE_FAILED"); }
  }
  let residue = "";
  try {
    residue = adminSql(`SELECT datname FROM pg_database WHERE datname='${database}' UNION ALL SELECT rolname FROM pg_roles WHERE rolname IN (${roles.map((role) => `'${role}'`).join(",")});`);
  } catch {
    errors.push("RESIDUE_SCAN_FAILED");
  }
  return { ok: errors.length === 0 && residue === "", errors, residueCount: residue ? residue.split("\n").filter(Boolean).length : 0 };
}

async function main() {
  let controlPrisma: PrismaClient | null = null;
  const startedAt = new Date().toISOString();
  try {
    adminSql(`CREATE ROLE ${migrator} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords.migrator}'; CREATE DATABASE ${database} OWNER ${migrator}; CREATE ROLE ${controlRole} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords.control}'; CREATE ROLE ${tenantA1} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords.a1}'; CREATE ROLE ${tenantA2} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords.a2}'; CREATE ROLE ${tenantB1} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords.b1}';`);
    const migrationUrl = `postgresql://${migrator}:${passwords.migrator}@127.0.0.1:5432/${database}?schema=public`;
    if (run("./node_modules/.bin/prisma", ["migrate", "deploy", "--schema", "prisma/schema.prisma"], { env: { ...process.env, DATABASE_URL: migrationUrl } }).status !== 0) throw new Error("MIGRATION_DEPLOY_FAILED");

    adminSql(`GRANT CONNECT ON DATABASE ${database} TO ${controlRole}, ${tenantA1}, ${tenantA2}, ${tenantB1}; GRANT USAGE ON SCHEMA public TO ${controlRole}, ${tenantA1}, ${tenantA2}, ${tenantB1}; GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "organizations", "users", "organization_memberships", "tenant_database_principals", "tenant_access_leases", "tenant_broker_audit_events" TO ${controlRole}; GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "donors", "donor_communications", "donations", "donation_campaigns", "projects", "invoices", "audit_logs" TO ${tenantA1}, ${tenantA2}, ${tenantB1};`, database);
    adminSql(`INSERT INTO "organizations" ("id","name","createdAt","updatedAt") VALUES ('${orgA}','Organization A',now(),now()),('${orgB}','Organization B',now(),now()); INSERT INTO "users" ("id","name","email","role","isActive","authVersion","activeOrganizationId","createdAt","updatedAt") VALUES ('${userA}','User A','a-${suffix}@audit.invalid','MEMBER',true,1,'${orgA}',now(),now()),('${userB}','User B','b-${suffix}@audit.invalid','MEMBER',true,1,'${orgB}',now(),now()); INSERT INTO "organization_memberships" ("id","organizationId","userId","role","isActive","policyVersion","createdAt","updatedAt") VALUES ('${membershipA}','${orgA}','${userA}','MEMBER',true,1,now(),now()),('${membershipB}','${orgB}','${userB}','MEMBER',true,1,now(),now()); INSERT INTO security.role_to_organization (role_oid, organization_id) VALUES ('${tenantA1}'::regrole::oid,'${orgA}'),('${tenantB1}'::regrole::oid,'${orgB}'); INSERT INTO "tenant_database_principals" ("id","organizationId","principalName","credentialReference","generation","status","activatedAt","createdAt","updatedAt") VALUES ('principal-a1','${orgA}','${tenantA1}','audit://financial/a1',1,'ACTIVE',now(),now(),now()),('principal-b1','${orgB}','${tenantB1}','audit://financial/b1',1,'ACTIVE',now(),now(),now()); INSERT INTO "donors" ("id","organizationId","name","phone","status","createdAt","updatedAt") VALUES ('donor-a','${orgA}','Donor A','0500000001','ACTIVE',now(),now()),('donor-b','${orgB}','Donor B','0500000002','ACTIVE',now(),now()); INSERT INTO "donation_campaigns" ("id","organizationId","title","targetAmount","startDate","status","displayOrder","createdAt","updatedAt") VALUES ('campaign-a','${orgA}','Campaign A',1000,now(),'ACTIVE',0,now(),now()),('campaign-b','${orgB}','Campaign B',1000,now(),'ACTIVE',0,now(),now()); INSERT INTO "projects" ("id","organizationId","title","targetAmount","startDate","status","createdAt","updatedAt") VALUES ('project-a','${orgA}','Project A',1000,now(),'ACTIVE',now(),now()),('project-b','${orgB}','Project B',1000,now(),'ACTIVE',now(),now()); INSERT INTO "donations" ("id","organizationId","donorId","campaignId","projectId","amount","paymentMethod","paymentRef","status","createdAt","updatedAt") VALUES ('donation-a','${orgA}','donor-a','campaign-a','project-a',100,'CARD','seed-a','COMPLETED',now(),now()),('donation-b','${orgB}','donor-b','campaign-b','project-b',200,'CARD','seed-b','COMPLETED',now(),now()); INSERT INTO "invoices" ("id","invoiceNo","donationId","amount","taxAmount","totalAmount","taxNumber","status","issuedAt","createdAt","updatedAt") VALUES ('invoice-a','seed-a','donation-a',100,0,100,'300000000000003','PAID',now(),now(),now()),('invoice-b','seed-b','donation-b',200,0,200,'300000000000003','PAID',now(),now(),now());`, database);

    const url = (role: string, password: string) => `postgresql://${role}:${password}@127.0.0.1:5432/${database}?schema=public`;
    controlPrisma = new PrismaClient({ datasources: { db: { url: url(controlRole, passwords.control) } } });
    const entries = new Map<string, { principalName: string; url: string }>([
      ["audit://financial/a1", { principalName: tenantA1, url: url(tenantA1, passwords.a1) }],
      ["audit://financial/a2", { principalName: tenantA2, url: url(tenantA2, passwords.a2) }],
      ["audit://financial/b1", { principalName: tenantB1, url: url(tenantB1, passwords.b1) }],
    ]);
    const unavailable = new Set<string>();
    const observations: Array<{ correlationId: string; identity: string; client: PrismaClient }> = [];
    let checkoutCount = 0;
    let discardCount = 0;
    const provider: TenantConnectionProvider = {
      async checkout(input) {
        const entry = entries.get(input.credentialReference);
        if (!entry || unavailable.has(input.credentialReference) || entry.principalName !== input.principalName) throw new Error("AUTHORITY_MAPPING_OR_PROVIDER_UNAVAILABLE");
        const prisma = new PrismaClient({ datasources: { db: { url: entry.url } } });
        const rows = await prisma.$queryRawUnsafe<Array<{ session_user: string }>>("SELECT session_user");
        if (rows[0]?.session_user !== input.principalName) {
          await prisma.$disconnect();
          throw new Error("SESSION_USER_MISMATCH");
        }
        checkoutCount += 1;
        observations.push({ correlationId: input.correlationId, identity: rows[0].session_user, client: prisma });
        return { prisma, discard: async () => { discardCount += 1; await prisma.$disconnect(); } };
      },
    };
    const authority = new TenantBoundPrismaCredentialAuthority(provider);
    const broker = new TenantAccessBroker(controlPrisma, authority, 5_000);
    const executor = new TenantBoundPrismaExecutor(broker);
    const repository = new FinancialRepository(executor);
    const ctxA = context({ organizationId: orgA, userId: userA, membershipId: membershipA, correlationId: "financial-runtime-a" });
    const ctxB = context({ organizationId: orgB, userId: userB, membershipId: membershipB, correlationId: "financial-runtime-b" });
    const sessionUser = (db: PrismaClient) => db.$queryRawUnsafe<Array<{ session_user: string }>>("SELECT session_user").then((rows) => rows[0]?.session_user);

    await record("F01", "FinancialRepository list operation consumes a Broker lease whose provider-verified session_user is the active A tenant LOGIN", async () => {
      const before = await controlPrisma!.tenantAccessLease.count({ where: { organizationId: orgA, correlationId: ctxA.correlationId, status: "CONSUMED" } });
      const donors = await repository.listDonors(ctxA);
      const after = await controlPrisma!.tenantAccessLease.count({ where: { organizationId: orgA, correlationId: ctxA.correlationId, status: "CONSUMED" } });
      const authenticatedA = observations.some((item) => item.correlationId === ctxA.correlationId && item.identity === tenantA1);
      return donors.length === 1 && donors[0]?.id === "donor-a" && after > before && authenticatedA;
    }, (actual) => actual === true);

    await record("F02", "A and B FinancialRepository list/read operations retain predicate-scoped donor and donation visibility", async () => {
      const [aDonors, aDonations, aForeign, bDonors, bDonations, bForeign] = await Promise.all([
        repository.listDonors(ctxA),
        repository.listDonations(ctxA, { skip: 0, take: 20 }),
        repository.getDonorById(ctxA, "donor-b"),
        repository.listDonors(ctxB),
        repository.listDonations(ctxB, { skip: 0, take: 20 }),
        repository.getDonorById(ctxB, "donor-a"),
      ]);
      return aDonors.length === 1 && aDonors[0]?.organizationId === orgA && aDonations.data.length === 1 && aDonations.data[0]?.organizationId === orgA && aForeign === null && bDonors.length === 1 && bDonors[0]?.organizationId === orgB && bDonations.data.length === 1 && bDonations.data[0]?.organizationId === orgB && bForeign === null;
    }, (actual) => actual === true);

    await record("F03", "A cannot add a donor communication to B donor and the tenant-scoped denial audit is retained under A", async () => {
      const outcome = await repository.addDonorCommunication(ctxA, "donor-b", { type: "NOTE", notes: "deny" });
      const deniedAudits = await executor.execute(ctxA, (db) => db.auditLog.count({ where: { organizationId: orgA, action: "TENANT_DONOR_CHILD_WRITE_DENIED", entity: "Donor", entityId: "donor-b" } }));
      return outcome === null && deniedAudits === 1;
    }, (actual) => actual === true);

    await record("F04", "createDonation rejects each cross-tenant donor, campaign, and project relation and writes the corresponding denial audit", async () => {
      const base = { amount: 10, paymentMethod: "CARD", paymentRef: "deny", invoiceNo: `deny-${suffix}`, taxNumber: "300000000000003" };
      const donorDenied = await forbiddenRelation(() => repository.createDonation(ctxA, { ...base, donorId: "donor-b" }));
      const campaignDenied = await forbiddenRelation(() => repository.createDonation(ctxA, { ...base, campaignId: "campaign-b" }));
      const projectDenied = await forbiddenRelation(() => repository.createDonation(ctxA, { ...base, projectId: "project-b" }));
      const actions = await executor.execute(ctxA, (db) => db.auditLog.findMany({ where: { organizationId: orgA, action: { in: ["TENANT_DONATION_DONOR_DENIED", "TENANT_DONATION_CAMPAIGN_DENIED", "TENANT_DONATION_PROJECT_DENIED"] } }, select: { action: true } }));
      const recorded = new Set(actions.map((item) => item.action));
      return donorDenied && campaignDenied && projectDenied && recorded.has("TENANT_DONATION_DONOR_DENIED") && recorded.has("TENANT_DONATION_CAMPAIGN_DENIED") && recorded.has("TENANT_DONATION_PROJECT_DENIED");
    }, (actual) => actual === true);

    await record("F05", "same-tenant donation creation persists A organization ownership and binds its invoice to the created donation", async () => {
      const created = await repository.createDonation(ctxA, { amount: 250, paymentMethod: "CARD", paymentRef: `approved-${suffix}`, donorId: "donor-a", campaignId: "campaign-a", projectId: "project-a", invoiceNo: `approved-${suffix}`, taxNumber: "300000000000003" });
      const listed = await repository.listDonations(ctxA, { skip: 0, take: 50 });
      return created.donation.organizationId === orgA && created.invoice.donationId === created.donation.id && listed.data.some((item) => item.id === created.donation.id && item.organizationId === orgA);
    }, (actual) => actual === true);

    await record("F06", "consumed lease replay, revoked lease, and stale session each fail before a further Financial data-plane operation", async () => {
      const before = checkoutCount;
      const consumed = await broker.issueLease(ctxA);
      await broker.execute(ctxA, consumed, async (input) => input.prisma ? sessionUser(input.prisma) : Promise.reject(new Error("MISSING_PRISMA")));
      const replay = await brokerDenied(() => broker.execute(ctxA, consumed, async () => "unexpected"), "LEASE_REPLAY");
      const revoked = await broker.issueLease(ctxB);
      await broker.revokeLease(revoked.leaseId, ctxB.correlationId);
      const revokedDenied = await brokerDenied(() => broker.execute(ctxB, revoked, async () => "unexpected"), "LEASE_REVOKED");
      const staleContext = context({ organizationId: orgA, userId: userA, membershipId: membershipA, correlationId: "financial-runtime-stale", sessionVersion: 0 });
      const staleDenied = await brokerDenied(() => executor.execute(staleContext, sessionUser), "STALE_SESSION");
      return replay && revokedDenied && staleDenied && checkoutCount === before + 1;
    }, (actual) => actual === true);

    await record("F07", "principal rotation retires A1 selection and rebinds the FinancialRepository path to tenant LOGIN A2", async () => {
      await controlPrisma!.tenantDatabasePrincipal.update({ where: { id: "principal-a1" }, data: { status: "REVOKED", revokedAt: new Date() } });
      adminSql(`UPDATE security.role_to_organization SET revoked_at = now() WHERE role_oid = '${tenantA1}'::regrole::oid AND revoked_at IS NULL; INSERT INTO security.role_to_organization (role_oid, organization_id) VALUES ('${tenantA2}'::regrole::oid,'${orgA}');`, database);
      await controlPrisma!.tenantDatabasePrincipal.create({ data: { id: "principal-a2", organizationId: orgA, principalName: tenantA2, credentialReference: "audit://financial/a2", generation: 2, status: "ACTIVE", activatedAt: new Date() } });
      entries.delete("audit://financial/a1");
      const start = observations.length;
      const donors = await repository.listDonors(ctxA);
      const rotationObservations = observations.slice(start).filter((item) => item.correlationId === ctxA.correlationId);
      return donors.length === 1 && rotationObservations.length === 1 && rotationObservations[0]?.identity === tenantA2;
    }, (actual) => actual === true);

    await record("F08", "tenant provider outage denies FinancialRepository execution with no global Prisma fallback", async () => {
      unavailable.add("audit://financial/a2");
      const denied = await brokerDenied(() => repository.listDonors(ctxA), "AUTHORITY_OR_OPERATION_FAILURE");
      unavailable.delete("audit://financial/a2");
      return denied;
    }, (actual) => actual === true);

    await record("F09", "parallel A2/B1 FinancialRepository operations retain distinct session_user-authenticated client instances and every checkout is discarded", async () => {
      const start = observations.length;
      const [a, b] = await Promise.all([repository.listDonors(ctxA), repository.listDonors(ctxB)]);
      const parallel = observations.slice(start).filter((item) => item.correlationId === ctxA.correlationId || item.correlationId === ctxB.correlationId);
      const aObservation = parallel.find((item) => item.correlationId === ctxA.correlationId);
      const bObservation = parallel.find((item) => item.correlationId === ctxB.correlationId);
      return a.length === 1 && b.length === 1 && aObservation?.identity === tenantA2 && bObservation?.identity === tenantB1 && aObservation.client !== bObservation.client && discardCount >= checkoutCount;
    }, (actual) => actual === true);

    await record("F10", "audit roles are non-superuser/non-BYPASSRLS and FinancialRepository source has no global Prisma, DATABASE_URL, or raw GUC identity fallback", async () => {
      const unsafeRoles = adminSql(`SELECT count(*) FROM pg_roles WHERE rolname IN ('${migrator}','${controlRole}','${tenantA1}','${tenantA2}','${tenantB1}') AND (rolsuper OR rolbypassrls)`, database);
      const source = readFileSync("src/lib/financial-repository.ts", "utf8");
      return unsafeRoles === "0" && !/(from "@\/lib\/db"|from '@\/lib\/db'|current_setting|set_config|DATABASE_URL)/.test(source);
    }, (actual) => actual === true);

    await controlPrisma.$disconnect();
    controlPrisma = null;
    const finalCleanup = cleanup();
    const payload: Record<string, unknown> = {
      status: "PENDING",
      startedAt,
      finishedAt: new Date().toISOString(),
      databaseAlias: database,
      environment: "disposable-postgresql-audit",
      mandatoryIds,
      evidence,
      hardFailures: [],
      cleanup: finalCleanup,
      hygiene: { status: "PENDING" },
      credentialsPersisted: false,
      productionResourcesTouched: false,
      rawGucIdentityUsed: false,
      globalPrismaFallback: false,
      ownerOrBypassUsedForTenantEvidence: false,
    };
    for (const item of evidence) item.cleanupStatus = finalCleanup.ok ? "PASS" : "FAIL";
    writeEvidence(payload);
    const hygieneRun = run("node", ["scripts/w02-audit-artifact-hygiene-scan.mjs"]);
    const hygienePass = hygieneRun.status === 0;
    payload.hygiene = { status: hygienePass ? "PASS_AUDIT_ARTIFACT_HYGIENE_SCAN" : "FAIL_AUDIT_ARTIFACT_HYGIENE_SCAN" };
    const f10 = evidence.find((item) => item.id === "F10");
    if (!finalCleanup.ok || !hygienePass || f10?.result !== "PASS") {
      if (f10) { f10.result = "FAIL"; f10.actual = false; }
    }
    const hardFailures = evidence.filter((item) => item.result !== "PASS").map((item) => item.id);
    payload.hardFailures = hardFailures;
    payload.status = !finalCleanup.ok ? "FAIL_CLEANUP" : !hygienePass ? "FAIL_HYGIENE" : hardFailures.length === 0 ? "PASS_FINANCIAL_DONOR_DONATION_RUNTIME" : "FAIL";
    writeEvidence(payload);
    process.stdout.write(`${JSON.stringify({ status: payload.status, evidenceFile, hardFailures, cleanup: finalCleanup, hygiene: payload.hygiene }, null, 2)}\n`);
    process.exitCode = payload.status === "PASS_FINANCIAL_DONOR_DONATION_RUNTIME" ? 0 : 2;
  } catch {
    if (controlPrisma) await controlPrisma.$disconnect().catch(() => undefined);
    const finalCleanup = cleanup();
    writeEvidence({ status: finalCleanup.ok ? "FAIL_SETUP_OR_HARNESS" : "FAIL_CLEANUP", startedAt, finishedAt: new Date().toISOString(), databaseAlias: database, error: "REDACTED_HARNESS_ERROR", mandatoryIds, cleanup: finalCleanup, hygiene: { status: "NOT_RUN" }, credentialsPersisted: false, productionResourcesTouched: false, rawGucIdentityUsed: false, globalPrismaFallback: false, ownerOrBypassUsedForTenantEvidence: false });
    process.stderr.write(`Financial donor/donation runtime proof failed; redacted evidence: ${evidenceFile}\n`);
    process.exitCode = 2;
  }
}

void main();
