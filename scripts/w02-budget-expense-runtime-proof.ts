import { randomBytes } from "node:crypto";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { BrokerDeniedError, TenantAccessBroker } from "../src/lib/tenant-access-broker";
import { TenantBoundPrismaCredentialAuthority, TenantBoundPrismaExecutor, type TenantConnectionProvider } from "../src/lib/tenant-bound-prisma-authority";
import { BudgetExpenseRepository, BudgetExpenseScopeError } from "../src/lib/budget-expense-repository";
import type { TenantContext } from "../src/lib/tenant-context";

/** W02 Budget/Expense runtime proof. No Financial RLS policy is created or enabled here. */
const suffix = `${Date.now()}_${process.pid}`;
const database = `asas_budget_runtime_audit_${suffix}`;
const migrator = `budget_runtime_migrator_${suffix}`;
const controlRole = `budget_runtime_control_${suffix}`;
const tenantA1 = `budget_runtime_a1_${suffix}`;
const tenantA2 = `budget_runtime_a2_${suffix}`;
const tenantB1 = `budget_runtime_b1_${suffix}`;
const evidenceFile = `/tmp/w02-budget-expense-evidence-${suffix}.json`;
const mandatoryIds = ["BE01", "BE02", "BE03", "BE04", "BE05", "BE06", "BE07", "BE08", "BE09", "BE10"];
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
  const result = run("sudo", ["-u", "postgres", "psql", "-d", db, "-X", "-v", "ON_ERROR_STOP=1", "-At"], { input: sql });
  if (result.status !== 0) throw new Error("AUDIT_ADMIN_SQL_FAILED");
  return result.stdout.trim();
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
    evidence.push({ id, expected, actual: typeof actual === "string" || typeof actual === "boolean" || typeof actual === "number" ? actual : "REDACTED_OBJECT", result: check(actual) ? "PASS" : "FAIL", timestamp: new Date().toISOString(), environment: "disposable-postgresql-audit", cleanupStatus: "PENDING" });
  } catch {
    evidence.push({ id, expected, actual: "REDACTED_EXCEPTION", result: "FAIL", timestamp: new Date().toISOString(), environment: "disposable-postgresql-audit", cleanupStatus: "PENDING" });
  }
}

async function brokerDenied(action: () => Promise<unknown>, code: string) {
  try { await action(); return false; } catch (error) { return error instanceof BrokerDeniedError && error.code === code; }
}

async function forbiddenRelation(action: () => Promise<unknown>) {
  try { await action(); return false; } catch (error) { return error instanceof BudgetExpenseScopeError && error.code === "FORBIDDEN_RELATION"; }
}

function cleanup() {
  const roles = [tenantA1, tenantA2, tenantB1, controlRole, migrator];
  const errors: string[] = [];
  try { adminSql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${database}' AND pid <> pg_backend_pid();`); } catch { errors.push("TERMINATE_FAILED"); }
  try { adminSql(`DROP DATABASE IF EXISTS ${database};`); } catch { errors.push("DROP_DATABASE_FAILED"); }
  for (const role of roles) try { adminSql(`DROP ROLE IF EXISTS ${role};`); } catch { errors.push("DROP_ROLE_FAILED"); }
  let residue = "";
  try { residue = adminSql(`SELECT datname FROM pg_database WHERE datname='${database}' UNION ALL SELECT rolname FROM pg_roles WHERE rolname IN (${roles.map((role) => `'${role}'`).join(",")});`); } catch { errors.push("RESIDUE_SCAN_FAILED"); }
  return { ok: errors.length === 0 && residue === "", errors, residueCount: residue ? residue.split("\n").filter(Boolean).length : 0 };
}

async function main() {
  let controlPrisma: PrismaClient | null = null;
  const startedAt = new Date().toISOString();
  try {
    adminSql(`CREATE ROLE ${migrator} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords.migrator}'; CREATE DATABASE ${database} OWNER ${migrator}; CREATE ROLE ${controlRole} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords.control}'; CREATE ROLE ${tenantA1} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords.a1}'; CREATE ROLE ${tenantA2} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords.a2}'; CREATE ROLE ${tenantB1} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords.b1}';`);
    const migrationUrl = `postgresql://${migrator}:${passwords.migrator}@127.0.0.1:5432/${database}?schema=public`;
    if (run("./node_modules/.bin/prisma", ["migrate", "deploy", "--schema", "prisma/schema.prisma"], { env: { ...process.env, DATABASE_URL: migrationUrl } }).status !== 0) throw new Error("MIGRATION_DEPLOY_FAILED");
    adminSql(`GRANT CONNECT ON DATABASE ${database} TO ${controlRole}, ${tenantA1}, ${tenantA2}, ${tenantB1}; GRANT USAGE ON SCHEMA public TO ${controlRole}, ${tenantA1}, ${tenantA2}, ${tenantB1}; GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "organizations", "users", "organization_memberships", "tenant_database_principals", "tenant_access_leases", "tenant_broker_audit_events" TO ${controlRole}; GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "budgets", "budget_items", "expenses", "audit_logs" TO ${tenantA1}, ${tenantA2}, ${tenantB1};`, database);
    adminSql([
      `INSERT INTO "organizations" ("id","name","createdAt","updatedAt") VALUES ('${orgA}','Organization A',now(),now()),('${orgB}','Organization B',now(),now());`,
      `INSERT INTO "users" ("id","name","email","role","isActive","authVersion","activeOrganizationId","createdAt","updatedAt") VALUES ('${userA}','User A','a-${suffix}@audit.invalid','MEMBER',true,1,'${orgA}',now(),now()),('${userB}','User B','b-${suffix}@audit.invalid','MEMBER',true,1,'${orgB}',now(),now());`,
      `INSERT INTO "organization_memberships" ("id","organizationId","userId","role","isActive","policyVersion","createdAt","updatedAt") VALUES ('${membershipA}','${orgA}','${userA}','MEMBER',true,1,now(),now()),('${membershipB}','${orgB}','${userB}','MEMBER',true,1,now(),now());`,
      `INSERT INTO security.role_to_organization (role_oid, organization_id) VALUES ('${tenantA1}'::regrole::oid,'${orgA}'),('${tenantB1}'::regrole::oid,'${orgB}');`,
      `INSERT INTO "tenant_database_principals" ("id","organizationId","principalName","credentialReference","generation","status","activatedAt","createdAt","updatedAt") VALUES ('principal-a1','${orgA}','${tenantA1}','audit://budget/a1',1,'ACTIVE',now(),now(),now()),('principal-b1','${orgB}','${tenantB1}','audit://budget/b1',1,'ACTIVE',now(),now(),now());`,
      `INSERT INTO "budgets" ("id","organizationId","title","fiscalYear","totalAmount","status","createdAt","updatedAt") VALUES ('budget-a','${orgA}','Budget A','2026',1000,'ACTIVE',now(),now()),('budget-b','${orgB}','Budget B','2026',2000,'ACTIVE',now(),now());`,
      `INSERT INTO "budget_items" ("id","organizationId","budgetId","category","allocated") VALUES ('item-a','${orgA}','budget-a','A',500),('item-b','${orgB}','budget-b','B',600);`,
      `INSERT INTO "expenses" ("id","organizationId","title","amount","status","budgetItemId") VALUES ('expense-a','${orgA}','Expense A',100,'PAID','item-a'),('expense-b','${orgB}','Expense B',200,'PAID','item-b');`,
    ].join(" "), database);

    const url = (role: string, password: string) => `postgresql://${role}:${password}@127.0.0.1:5432/${database}?schema=public`;
    controlPrisma = new PrismaClient({ datasources: { db: { url: url(controlRole, passwords.control) } } });
    const entries = new Map<string, { principalName: string; url: string }>([
      ["audit://budget/a1", { principalName: tenantA1, url: url(tenantA1, passwords.a1) }],
      ["audit://budget/a2", { principalName: tenantA2, url: url(tenantA2, passwords.a2) }],
      ["audit://budget/b1", { principalName: tenantB1, url: url(tenantB1, passwords.b1) }],
    ]);
    const unavailable = new Set<string>();
    const observations: Array<{ correlationId: string; identity: string; client: PrismaClient }> = [];
    let checkoutCount = 0;
    let discardCount = 0;
    const provider: TenantConnectionProvider = { async checkout(input) {
      const entry = entries.get(input.credentialReference);
      if (!entry || unavailable.has(input.credentialReference) || entry.principalName !== input.principalName) throw new Error("AUTHORITY_MAPPING_OR_PROVIDER_UNAVAILABLE");
      const prisma = new PrismaClient({ datasources: { db: { url: entry.url } } });
      const rows = await prisma.$queryRawUnsafe<Array<{ session_user: string }>>("SELECT session_user");
      if (rows[0]?.session_user !== input.principalName) { await prisma.$disconnect(); throw new Error("SESSION_USER_MISMATCH"); }
      checkoutCount += 1;
      observations.push({ correlationId: input.correlationId, identity: rows[0].session_user, client: prisma });
      return { prisma, discard: async () => { discardCount += 1; await prisma.$disconnect(); } };
    } };
    const authority = new TenantBoundPrismaCredentialAuthority(provider);
    const broker = new TenantAccessBroker(controlPrisma, authority, 5_000);
    const executor = new TenantBoundPrismaExecutor(broker);
    const repository = new BudgetExpenseRepository(executor);
    const ctxA = context({ organizationId: orgA, userId: userA, membershipId: membershipA, correlationId: "budget-runtime-a" });
    const ctxB = context({ organizationId: orgB, userId: userB, membershipId: membershipB, correlationId: "budget-runtime-b" });
    const sessionUser = (db: PrismaClient) => db.$queryRawUnsafe<Array<{ session_user: string }>>("SELECT session_user").then((rows) => rows[0]?.session_user);

    await record("BE01", "BudgetExpenseRepository consumes a Broker lease whose provider verifies A tenant session_user", async () => {
      const before = await controlPrisma!.tenantAccessLease.count({ where: { organizationId: orgA, correlationId: ctxA.correlationId, status: "CONSUMED" } });
      const budgets = await repository.listBudgets(ctxA);
      const after = await controlPrisma!.tenantAccessLease.count({ where: { organizationId: orgA, correlationId: ctxA.correlationId, status: "CONSUMED" } });
      return budgets.length === 1 && budgets[0]?.id === "budget-a" && after > before && observations.some((item) => item.correlationId === ctxA.correlationId && item.identity === tenantA1);
    }, (actual) => actual === true);

    await record("BE02", "A/B budget reads and nested item/expense lists retain their own organization while foreign roots are hidden", async () => {
      const [a, b, aForeign, bForeign, aExpenses, bExpenses] = await Promise.all([repository.listBudgets(ctxA), repository.listBudgets(ctxB), repository.getBudgetById(ctxA, "budget-b"), repository.getBudgetById(ctxB, "budget-a"), repository.listExpensesForBudgetItem(ctxA, "item-a"), repository.listExpensesForBudgetItem(ctxB, "item-b")]);
      return a.length === 1 && a[0]?.organizationId === orgA && a[0]?.items[0]?.organizationId === orgA && b.length === 1 && b[0]?.organizationId === orgB && b[0]?.items[0]?.organizationId === orgB && aForeign === null && bForeign === null && aExpenses.length === 1 && aExpenses[0]?.organizationId === orgA && bExpenses.length === 1 && bExpenses[0]?.organizationId === orgB;
    }, (actual) => actual === true);

    await record("BE03", "A cannot add BudgetItem to B budget and records an A-scoped denial audit", async () => {
      const denied = await forbiddenRelation(() => repository.addBudgetItem(ctxA, { budgetId: "budget-b", category: "foreign", allocated: 1 }));
      const audits = await executor.execute(ctxA, (db) => db.auditLog.count({ where: { organizationId: orgA, action: "TENANT_BUDGET_ITEM_PARENT_DENIED", entityId: "budget-b" } }));
      return denied && audits === 1;
    }, (actual) => actual === true);

    await record("BE04", "A cannot read or create Expense through B BudgetItem and records tenant-scoped denial audit", async () => {
      const hidden = await repository.listExpensesForBudgetItem(ctxA, "item-b");
      const denied = await forbiddenRelation(() => repository.createExpense(ctxA, { budgetItemId: "item-b", title: "foreign", amount: 1 }));
      const audits = await executor.execute(ctxA, (db) => db.auditLog.count({ where: { organizationId: orgA, action: { in: ["TENANT_EXPENSE_ITEM_READ_DENIED", "TENANT_EXPENSE_ITEM_WRITE_DENIED"] }, entityId: "item-b" } }));
      return hidden.length === 0 && denied && audits === 2;
    }, (actual) => actual === true);

    await record("BE05", "same-tenant BudgetItem and Expense writes persist A ownership and parent-chain consistency", async () => {
      const item = await repository.addBudgetItem(ctxA, { budgetId: "budget-a", category: "new", allocated: 300 });
      const expense = await repository.createExpense(ctxA, { budgetItemId: item.id, title: "A expense", amount: 25, status: "APPROVED" });
      const chain = await executor.execute(ctxA, (db) => db.expense.findFirst({ where: { id: expense.id }, include: { budgetItem: { include: { budget: true } } } }));
      return item.organizationId === orgA && expense.organizationId === orgA && chain?.budgetItem?.organizationId === orgA && chain.budgetItem?.budget.organizationId === orgA;
    }, (actual) => actual === true);

    await record("BE06", "consumed lease replay, revoked lease, and stale session deny before a further Budget/Expense data-plane operation", async () => {
      const before = checkoutCount;
      const consumed = await broker.issueLease(ctxA);
      await broker.execute(ctxA, consumed, async (input) => input.prisma ? sessionUser(input.prisma) : Promise.reject(new Error("MISSING_PRISMA")));
      const replay = await brokerDenied(() => broker.execute(ctxA, consumed, async () => "unexpected"), "LEASE_REPLAY");
      const revoked = await broker.issueLease(ctxB);
      await broker.revokeLease(revoked.leaseId, ctxB.correlationId);
      const revokedDenied = await brokerDenied(() => broker.execute(ctxB, revoked, async () => "unexpected"), "LEASE_REVOKED");
      const stale = context({ organizationId: orgA, userId: userA, membershipId: membershipA, correlationId: "budget-runtime-stale", sessionVersion: 0 });
      const staleDenied = await brokerDenied(() => executor.execute(stale, sessionUser), "STALE_SESSION");
      return replay && revokedDenied && staleDenied && checkoutCount === before + 1;
    }, (actual) => actual === true);

    await record("BE07", "principal rotation retires A1 and rebinds Budget/Expense repository execution to A2 session_user", async () => {
      await controlPrisma!.tenantDatabasePrincipal.update({ where: { id: "principal-a1" }, data: { status: "REVOKED", revokedAt: new Date() } });
      adminSql(`UPDATE security.role_to_organization SET revoked_at = now() WHERE role_oid = '${tenantA1}'::regrole::oid AND revoked_at IS NULL; INSERT INTO security.role_to_organization (role_oid, organization_id) VALUES ('${tenantA2}'::regrole::oid,'${orgA}');`, database);
      await controlPrisma!.tenantDatabasePrincipal.create({ data: { id: "principal-a2", organizationId: orgA, principalName: tenantA2, credentialReference: "audit://budget/a2", generation: 2, status: "ACTIVE", activatedAt: new Date() } });
      entries.delete("audit://budget/a1");
      const start = observations.length;
      const budgets = await repository.listBudgets(ctxA);
      const rotation = observations.slice(start).filter((item) => item.correlationId === ctxA.correlationId);
      return budgets.length === 1 && rotation.length === 1 && rotation[0]?.identity === tenantA2;
    }, (actual) => actual === true);

    await record("BE08", "provider outage fails closed without a global Prisma fallback", async () => {
      unavailable.add("audit://budget/a2");
      const denied = await brokerDenied(() => repository.listBudgets(ctxA), "AUTHORITY_OR_OPERATION_FAILURE");
      unavailable.delete("audit://budget/a2");
      return denied;
    }, (actual) => actual === true);

    await record("BE09", "parallel A2/B1 operations retain distinct authenticated clients and every checkout is discarded", async () => {
      const start = observations.length;
      const [a, b] = await Promise.all([repository.listBudgets(ctxA), repository.listBudgets(ctxB)]);
      const parallel = observations.slice(start).filter((item) => item.correlationId === ctxA.correlationId || item.correlationId === ctxB.correlationId);
      const aObservation = parallel.find((item) => item.correlationId === ctxA.correlationId);
      const bObservation = parallel.find((item) => item.correlationId === ctxB.correlationId);
      return a.length === 1 && b.length === 1 && aObservation?.identity === tenantA2 && bObservation?.identity === tenantB1 && aObservation.client !== bObservation.client && discardCount >= checkoutCount;
    }, (actual) => actual === true);

    await record("BE10", "audit roles are non-superuser/non-BYPASSRLS and Budget/Expense source has no local/global Prisma, DATABASE_URL, or raw GUC identity path", async () => {
      const unsafeRoles = adminSql(`SELECT count(*) FROM pg_roles WHERE rolname IN ('${migrator}','${controlRole}','${tenantA1}','${tenantA2}','${tenantB1}') AND (rolsuper OR rolbypassrls)`, database);
      const combined = ["src/lib/budget-expense-repository.ts", "src/modules/finance/budget.ts", "src/modules/finance/expenses.ts"].map((path) => readFileSync(path, "utf8")).join("\n");
      return unsafeRoles === "0" && !/(from "@\/lib\/db"|new PrismaClient|current_setting|set_config|DATABASE_URL)/.test(combined);
    }, (actual) => actual === true);

    await controlPrisma.$disconnect();
    controlPrisma = null;
    const finalCleanup = cleanup();
    const payload: Record<string, unknown> = { status: "PENDING", startedAt, finishedAt: new Date().toISOString(), databaseAlias: database, environment: "disposable-postgresql-audit", mandatoryIds, evidence, hardFailures: [], cleanup: finalCleanup, hygiene: { status: "PENDING" }, credentialsPersisted: false, productionResourcesTouched: false, rawGucIdentityUsed: false, globalPrismaFallback: false, ownerOrBypassUsedForTenantEvidence: false };
    for (const item of evidence) item.cleanupStatus = finalCleanup.ok ? "PASS" : "FAIL";
    writeEvidence(payload);
    const hygieneRun = run("node", ["scripts/w02-audit-artifact-hygiene-scan.mjs"]);
    const hygienePass = hygieneRun.status === 0;
    payload.hygiene = { status: hygienePass ? "PASS_AUDIT_ARTIFACT_HYGIENE_SCAN" : "FAIL_AUDIT_ARTIFACT_HYGIENE_SCAN" };
    const f10 = evidence.find((item) => item.id === "BE10");
    if (!finalCleanup.ok || !hygienePass || f10?.result !== "PASS") { if (f10) { f10.result = "FAIL"; f10.actual = false; } }
    const hardFailures = evidence.filter((item) => item.result !== "PASS").map((item) => item.id);
    payload.hardFailures = hardFailures;
    payload.status = !finalCleanup.ok ? "FAIL_CLEANUP" : !hygienePass ? "FAIL_HYGIENE" : hardFailures.length === 0 ? "PASS_BUDGET_EXPENSE_RUNTIME" : "FAIL";
    writeEvidence(payload);
    process.stdout.write(`${JSON.stringify({ status: payload.status, evidenceFile, hardFailures, cleanup: finalCleanup, hygiene: payload.hygiene }, null, 2)}\n`);
    process.exitCode = payload.status === "PASS_BUDGET_EXPENSE_RUNTIME" ? 0 : 2;
  } catch {
    if (controlPrisma) await controlPrisma.$disconnect().catch(() => undefined);
    const finalCleanup = cleanup();
    writeEvidence({ status: finalCleanup.ok ? "FAIL_SETUP_OR_HARNESS" : "FAIL_CLEANUP", startedAt, finishedAt: new Date().toISOString(), databaseAlias: database, error: "REDACTED_HARNESS_ERROR", mandatoryIds, cleanup: finalCleanup, hygiene: { status: "NOT_RUN" }, credentialsPersisted: false, productionResourcesTouched: false, rawGucIdentityUsed: false, globalPrismaFallback: false, ownerOrBypassUsedForTenantEvidence: false });
    process.stderr.write(`Budget/Expense runtime proof failed; redacted evidence: ${evidenceFile}\n`);
    process.exitCode = 2;
  }
}

void main();
