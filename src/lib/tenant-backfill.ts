import { prisma } from "@/lib/db";

const TABLES = ["beneficiaries", "donors", "donations", "donation_campaigns", "projects", "news", "events", "tasks", "surveys", "documents"] as const;

export type TenantBackfillReport = { organizationId: string; dryRun: boolean; rows: Array<{ table: string; unassigned: number; orphaned: number; updated: number }> };

export async function runLegacyTenantBackfill(input: { organizationId: string; apply: boolean }): Promise<TenantBackfillReport> {
  const organization = await prisma.organization.findUnique({ where: { id: input.organizationId }, select: { id: true } });
  if (!organization) throw new Error("Legacy mapping organization does not exist.");
  const rows = [];
  for (const table of TABLES) {
    const [count] = await prisma.$queryRawUnsafe<Array<{ unassigned: bigint; orphaned: bigint }>>(
      `SELECT COUNT(*) FILTER (WHERE "organizationId" IS NULL)::bigint AS unassigned, COUNT(*) FILTER (WHERE "organizationId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "organizations" o WHERE o."id" = "${table}"."organizationId"))::bigint AS orphaned FROM "${table}"`,
    );
    if (count.orphaned > 0) throw new Error(`Backfill refused: ${table} contains orphaned organization references.`);
    let updated = 0;
    if (input.apply && count.unassigned > 0) {
      updated = await prisma.$executeRawUnsafe(`UPDATE "${table}" SET "organizationId" = $1 WHERE "organizationId" IS NULL`, input.organizationId);
    }
    rows.push({ table, unassigned: Number(count.unassigned), orphaned: Number(count.orphaned), updated });
  }
  if (input.apply) {
    await prisma.auditLog.create({ data: { organizationId: input.organizationId, action: "LEGACY_TENANT_BACKFILL_APPLIED", entity: "TenantBackfill", details: { rows } } });
  }
  return { organizationId: input.organizationId, dryRun: !input.apply, rows };
}
