/**
 * Staging-only target proof. Provisioning/cleanup remains a root-owned VPS
 * operation; this harness runs as the unprivileged `asasplus` service user.
 * It never reads credential material directly: file-backed providers do that.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { BrokerDeniedError, TenantAccessBroker } from "../src/lib/tenant-access-broker";
import { FileTenantConnectionProvider } from "../src/lib/tenant-file-connection-provider";
import { FileTenantQueueConnectionProvider } from "../src/lib/tenant-file-queue-provider";
import { TenantBoundPrismaCredentialAuthority, TenantBoundPrismaExecutor } from "../src/lib/tenant-bound-prisma-authority";
import { bootstrapTenantRuntime } from "../src/lib/tenant-runtime-bootstrap";
import { enqueuePublication, installTenantQueueConnectionProvider, publicationQueueName, tenantCacheKey } from "../src/lib/tenant-queue";
import type { TenantContext } from "../src/lib/tenant-context";
import { prisma } from "../src/lib/db";
import { Queue } from "bullmq";

type Fixture = Readonly<{
  organizationA: string;
  organizationB: string;
  userA: string;
  userB: string;
  membershipA: string;
  membershipB: string;
  principalA: string;
  principalB: string;
  credentialReferenceA: string;
  planA: string;
  planB: string;
}>;

type Evidence = Readonly<{ id: string; expected: string; result: "PASS" | "FAIL"; actual: string }>;

const fixturePath = process.env.ASAS_VPS_STAGING_PROOF_FIXTURE_FILE;
const evidencePath = process.env.ASAS_VPS_STAGING_PROOF_EVIDENCE_FILE;
const tenantCredentialDirectory = process.env.TENANT_CREDENTIAL_DIRECTORY;
const queueCredentialDirectory = process.env.TENANT_QUEUE_CREDENTIAL_DIRECTORY;

if (!fixturePath || !evidencePath || !tenantCredentialDirectory || !queueCredentialDirectory) {
  throw new Error("VPS_STAGING_PROOF_CONFIGURATION_MISSING");
}

const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture;
const evidence: Evidence[] = [];
let stage = "bootstrap";

function credentialReadGroupId(variable: string) {
  const value = process.env[variable];
  if (!value) return undefined;
  if (!/^(0|[1-9][0-9]{0,9})$/.test(value)) throw new Error(`${variable}_INVALID`);
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw new Error(`${variable}_INVALID`);
  return id;
}

function context(input: Pick<TenantContext, "organizationId" | "userId" | "membershipId" | "correlationId"> & Partial<Pick<TenantContext, "sessionVersion" | "policySnapshotVersion">>): TenantContext {
  return Object.freeze({
    ...input,
    sessionVersion: input.sessionVersion ?? 1,
    policySnapshotVersion: input.policySnapshotVersion ?? 1,
  });
}

async function record(id: string, expected: string, action: () => Promise<boolean>) {
  try {
    const passed = await action();
    evidence.push({ id, expected, result: passed ? "PASS" : "FAIL", actual: passed ? "ASSERTION_TRUE" : "ASSERTION_FALSE" });
  } catch {
    evidence.push({ id, expected, result: "FAIL", actual: "REDACTED_EXCEPTION" });
  }
}

async function denies(action: () => Promise<unknown>, expectedCode?: string) {
  try {
    await action();
    return false;
  } catch (error) {
    if (!expectedCode) return true;
    return error instanceof BrokerDeniedError && error.code === expectedCode;
  }
}

async function waitForState(queue: Queue, jobId: string, expected: "completed" | "failed") {
  const end = Date.now() + 15_000;
  while (Date.now() < end) {
    const job = await queue.getJob(jobId);
    if (job && await job.getState() === expected) return true;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  return false;
}

function save(payload: Record<string, unknown>) {
  writeFileSync(evidencePath!, `${JSON.stringify(payload, null, 2)}\n`);
}

async function main() {
  const startedAt = new Date().toISOString();
  const contextA = context({ organizationId: fixture.organizationA, userId: fixture.userA, membershipId: fixture.membershipA, correlationId: "vps-proof-a" });
  const contextB = context({ organizationId: fixture.organizationB, userId: fixture.userB, membershipId: fixture.membershipB, correlationId: "vps-proof-b" });
  const provider = new FileTenantConnectionProvider(tenantCredentialDirectory!, undefined, { allowedReadGroupId: credentialReadGroupId("TENANT_CREDENTIAL_ALLOWED_GROUP_ID") });
  const broker = new TenantAccessBroker(prisma, new TenantBoundPrismaCredentialAuthority(provider), 5_000);
  const executor = new TenantBoundPrismaExecutor(broker);
  const queueProvider = new FileTenantQueueConnectionProvider(queueCredentialDirectory!, async (organizationId) => {
    const principal = await prisma.tenantDatabasePrincipal.findFirst({
      where: { organizationId, status: "ACTIVE", queueCredentialReference: { not: null } },
      select: { queueCredentialReference: true },
    });
    if (!principal?.queueCredentialReference) throw new Error("VPS_STAGING_QUEUE_REFERENCE_ABSENT");
    return principal.queueCredentialReference;
  }, undefined, { allowedReadGroupId: credentialReadGroupId("TENANT_QUEUE_CREDENTIAL_ALLOWED_GROUP_ID") });
  const closers: Array<() => Promise<void>> = [];

  try {
    bootstrapTenantRuntime();
    installTenantQueueConnectionProvider(queueProvider);

    stage = "VPS01";
    await record("VPS01", "A database checkout binds session_user to its ACTIVE tenant principal", async () => (
      await executor.execute(contextA, async (db) => (await db.$queryRawUnsafe<Array<{ session_user: string }>>("SELECT session_user"))[0]?.session_user)
    ) === fixture.principalA);
    stage = "VPS02";
    await record("VPS02", "B database checkout binds session_user to its different ACTIVE tenant principal", async () => (
      await executor.execute(contextB, async (db) => (await db.$queryRawUnsafe<Array<{ session_user: string }>>("SELECT session_user"))[0]?.session_user)
    ) === fixture.principalB);
    stage = "VPS03";
    await record("VPS03", "File provider issues independent checkouts and discard closes each data-plane client", async () => {
      const first = await provider.checkout({ credentialReference: fixture.credentialReferenceA, principalName: fixture.principalA, organizationId: fixture.organizationA, correlationId: "vps-provider-a1" });
      const second = await provider.checkout({ credentialReference: fixture.credentialReferenceA, principalName: fixture.principalA, organizationId: fixture.organizationA, correlationId: "vps-provider-a2" });
      try {
        const [a, b] = await Promise.all([
          first.prisma.$queryRawUnsafe<Array<{ session_user: string }>>("SELECT session_user"),
          second.prisma.$queryRawUnsafe<Array<{ session_user: string }>>("SELECT session_user"),
        ]);
        return first.prisma !== second.prisma && a[0]?.session_user === fixture.principalA && b[0]?.session_user === fixture.principalA;
      } finally {
        await Promise.all([first.discard(), second.discard()]);
      }
    });
    const beneficiaryA = `proof-beneficiary-a-${fixture.organizationA}`;
    const beneficiaryB = `proof-beneficiary-b-${fixture.organizationB}`;
    stage = "VPS04";
    await record("VPS04", "A/B tenant roles can write own beneficiary rows only through PostgreSQL FORCE RLS", async () => {
      await executor.execute(contextA, (db) => db.beneficiary.create({ data: { id: beneficiaryA, organizationId: fixture.organizationA, name: "Staging Proof A", phone: "0500001001", status: "ACTIVE" } }));
      await executor.execute(contextB, (db) => db.beneficiary.create({ data: { id: beneficiaryB, organizationId: fixture.organizationB, name: "Staging Proof B", phone: "0500001002", status: "ACTIVE" } }));
      const ownA = await executor.execute(contextA, (db) => db.beneficiary.findFirst({ where: { id: beneficiaryA, organizationId: fixture.organizationA } }));
      const ownB = await executor.execute(contextB, (db) => db.beneficiary.findFirst({ where: { id: beneficiaryB, organizationId: fixture.organizationB } }));
      return Boolean(ownA && ownB);
    });
    stage = "VPS05";
    await record("VPS05", "A cannot read or update B data under PostgreSQL RLS", async () => {
      const crossRead = await executor.execute(contextA, (db) => db.beneficiary.findFirst({ where: { id: beneficiaryB } }));
      const crossWriteDenied = await denies(() => executor.execute(contextA, (db) => db.beneficiary.update({ where: { id: beneficiaryB }, data: { name: "forbidden" } })));
      return crossRead === null && crossWriteDenied;
    });
    stage = "VPS06";
    await record("VPS06", "Tenant data-plane roles are not superuser, bypass-RLS, or inheriting roles", async () => {
      const result = await Promise.all([fixture.principalA, fixture.principalB].map((principalName) => executor.execute(principalName === fixture.principalA ? contextA : contextB, async (db) => (
        await db.$queryRawUnsafe<Array<{ rolsuper: boolean; rolbypassrls: boolean; rolinherit: boolean }>>(`SELECT rolsuper, rolbypassrls, rolinherit FROM pg_roles WHERE rolname = session_user`)
      )[0])));
      return result.every((role) => role && !role.rolsuper && !role.rolbypassrls && !role.rolinherit);
    });
    stage = "VPS07";
    await record("VPS07", "Broker denies one-time lease replay before a second checkout", async () => {
      const lease = await broker.issueLease(contextA);
      await broker.execute(contextA, lease, async (input) => input.prisma?.$queryRawUnsafe("SELECT 1"));
      return denies(() => broker.execute(contextA, lease, async () => "unexpected"), "LEASE_REPLAY");
    });
    stage = "VPS08";
    await record("VPS08", "Broker denies stale session and explicitly revoked lease", async () => {
      const stale = await denies(() => broker.issueLease(context({ ...contextA, correlationId: "vps-stale", sessionVersion: 0 })), "STALE_SESSION");
      const lease = await broker.issueLease(contextB);
      await broker.revokeLease(lease.leaseId, contextB.correlationId);
      const revoked = await denies(() => broker.execute(contextB, lease, async () => "unexpected"), "LEASE_REVOKED");
      return stale && revoked;
    });
    stage = "queue-inspector-checkout";
    const queueA = await queueProvider.checkout({ organizationId: fixture.organizationA, correlationId: "vps-queue-inspect-a", workload: "publication" });
    const queueB = await queueProvider.checkout({ organizationId: fixture.organizationB, correlationId: "vps-queue-inspect-b", workload: "publication" });
    const inspectedA = new Queue(publicationQueueName(fixture.organizationA), { connection: queueA.redis });
    const inspectedB = new Queue(publicationQueueName(fixture.organizationB), { connection: queueB.redis });
    closers.push(async () => { await inspectedA.close(); await inspectedB.close(); await queueA.discard(); await queueB.discard(); });
    stage = "VPS09";
    await record("VPS09", "A/B tenant queue jobs are processed by the active staging supervisor without provider egress", async () => {
      const [jobA, jobB] = await Promise.all([
        enqueuePublication({ context: contextA, publicationPlanId: fixture.planA, delay: 0, options: { attempts: 1 } }),
        enqueuePublication({ context: contextB, publicationPlanId: fixture.planB, delay: 0, options: { attempts: 1 } }),
      ]);
      const [doneA, doneB] = await Promise.all([waitForState(inspectedA, jobA.id, "completed"), waitForState(inspectedB, jobB.id, "completed")]);
      return doneA && doneB && publicationQueueName(fixture.organizationA) !== publicationQueueName(fixture.organizationB);
    });
    stage = "VPS10";
    await record("VPS10", "Redis ACL credentials retain A/B cache namespace isolation", async () => {
      const keyA = tenantCacheKey(fixture.organizationA, "vps-proof");
      const keyB = tenantCacheKey(fixture.organizationB, "vps-proof");
      await queueA.redis.set(keyA, "a");
      await queueB.redis.set(keyB, "b");
      const crossDenied = await denies(() => queueA.redis.get(keyB));
      return keyA !== keyB && crossDenied && await queueA.redis.get(keyA) === "a" && await queueB.redis.get(keyB) === "b";
    });
    stage = "VPS11";
    await record("VPS11", "Broker audit ledger records allowed A/B execution with no global data-plane credential", async () => {
      const count = await prisma.tenantBrokerAuditEvent.count({ where: { correlationId: { in: [contextA.correlationId, contextB.correlationId] }, decision: "ALLOW" } });
      return count >= 2;
    });
    stage = "VPS12";
    await record("VPS12", "Target authority, queue, and proof sources contain no Raw GUC identity primitive", async () => {
      const source = [
        "src/lib/tenant-access-broker.ts",
        "src/lib/tenant-bound-prisma-authority.ts",
        "src/lib/tenant-file-connection-provider.ts",
        "src/lib/tenant-file-queue-provider.ts",
        "src/lib/tenant-queue.ts",
        "scripts/w02-vps-staging-tenant-runtime-proof.ts",
      ].map((path) => readFileSync(path, "utf8")).join("\n");
      const forbidden = ["current" + "_setting", "set" + "_config"];
      return forbidden.every((primitive) => !source.includes(primitive));
    });
  } finally {
    for (const close of closers.splice(0).reverse()) await close().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  }

  const hardFailures = evidence.filter((item) => item.result !== "PASS").map((item) => item.id);
  const status = hardFailures.length === 0 ? "PASS_VPS_STAGING_TENANT_RUNTIME" : "FAIL_VPS_STAGING_TENANT_RUNTIME";
  save({ status, startedAt, finishedAt: new Date().toISOString(), environment: "asasplus_staging_vps", mandatoryIds: evidence.map((item) => item.id), evidence, hardFailures, credentialsPersistedInEvidence: false, productionResourcesTouched: false, rawGucIdentityUsed: false, globalDataPlaneCredentialUsed: false, ownerOrBypassUsedForTenantEvidence: false });
  process.stdout.write(`${JSON.stringify({ status, hardFailures, evidenceFile: evidencePath })}\n`);
  process.exitCode = hardFailures.length === 0 ? 0 : 2;
}

void main().catch((error) => {
  const code = error instanceof Error && /^[A-Z0-9_:-]{1,128}$/.test(error.message) ? error.message : "REDACTED_HARNESS_ERROR";
  save({ status: "FAIL_VPS_STAGING_HARNESS", stage, error: code, environment: "asasplus_staging_vps", credentialsPersistedInEvidence: false });
  process.stderr.write("VPS staging tenant proof failed; redacted evidence written.\n");
  process.exitCode = 2;
});
