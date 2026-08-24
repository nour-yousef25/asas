/** W02 tenant publication supervisor. Empty provisioning is an intentional idle state, never a global queue fallback. */
import { prisma } from "@/lib/db";
import { FileTenantQueueConnectionProvider } from "@/lib/tenant-file-queue-provider";
import { installTenantQueueConnectionProvider, createTenantPublicationWorker } from "@/lib/tenant-queue";
import { bootstrapTenantRuntime } from "@/lib/tenant-runtime-bootstrap";
import { requireTenantBoundPrismaExecutor } from "@/lib/tenant-bound-prisma-authority";
import { publishPlanById } from "@/lib/communications/publisher";

async function main() {
  const directory = process.env.TENANT_QUEUE_CREDENTIAL_DIRECTORY;
  if (!directory) throw new Error("TENANT_QUEUE_PROVIDER_UNCONFIGURED");
  bootstrapTenantRuntime();
  const provider = new FileTenantQueueConnectionProvider(directory, async (organizationId) => {
    const principal = await prisma.tenantDatabasePrincipal.findFirst({ where: { organizationId, status: "ACTIVE", queueCredentialReference: { not: null } }, select: { queueCredentialReference: true } });
    if (!principal?.queueCredentialReference) throw new Error("TENANT_QUEUE_PRINCIPAL_MAPPING_ABSENT");
    return principal.queueCredentialReference;
  });
  installTenantQueueConnectionProvider(provider);
  const principals = await prisma.tenantDatabasePrincipal.findMany({ where: { status: "ACTIVE", queueCredentialReference: { not: null } }, select: { organizationId: true } });
  const workers = await Promise.all(principals.map(({ organizationId }) => createTenantPublicationWorker({ organizationId, executor: requireTenantBoundPrismaExecutor(), handler: ({ context, publicationPlanId }) => publishPlanById({ context, publicationPlanId }), provider })));
  console.log(`Tenant publication supervisor active for ${workers.length} provisioned tenant(s).`);
  const close = async () => { await Promise.all(workers.map((worker) => worker.close())); await prisma.$disconnect(); };
  process.once("SIGTERM", () => { void close().then(() => process.exit(0)); });
  process.once("SIGINT", () => { void close().then(() => process.exit(0)); });
}

void main().catch((error) => { console.error("Tenant publication supervisor failed:", error instanceof Error ? error.message : "UNKNOWN"); process.exit(1); });
