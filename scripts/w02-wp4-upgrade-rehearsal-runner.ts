import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { LEGACY_TENANT_TABLES, analyzeLegacyTenantBackfill, applyLegacyTenantBackfill, type LegacyTenantMapping } from "@/lib/tenant-backfill";

async function main() {
  const manifestPath = process.env.REHEARSAL_MANIFEST_PATH;
  if (!manifestPath) throw new Error("REHEARSAL_MANIFEST_PATH is required.");
  const mappings = JSON.parse(await readFile(manifestPath, "utf8")) as LegacyTenantMapping[];
  const analyze = await analyzeLegacyTenantBackfill(mappings);
  if (analyze.blockers.length > 0) throw new Error(JSON.stringify({ stage: "ANALYZE_BLOCKED", analyze }));
  const apply = await applyLegacyTenantBackfill(mappings);
  const tableAudit = [];
  for (const table of LEGACY_TENANT_TABLES) {
    const [row] = await prisma.$queryRawUnsafe<Array<{ total: bigint; nulls: bigint; a: bigint; b: bigint }>>(`SELECT COUNT(*)::bigint AS total, COUNT(*) FILTER (WHERE "organizationId" IS NULL)::bigint AS nulls, COUNT(*) FILTER (WHERE "organizationId" = 'rehearsal-org-a')::bigint AS a, COUNT(*) FILTER (WHERE "organizationId" = 'rehearsal-org-b')::bigint AS b FROM "${table}"`);
    tableAudit.push({ table, total: Number(row.total), nulls: Number(row.nulls), organizationA: Number(row.a), organizationB: Number(row.b) });
  }
  console.log(JSON.stringify({ status: "PASS", analyze, apply, tableAudit }));
  await prisma.$disconnect();
}
main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
