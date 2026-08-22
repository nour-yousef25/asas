import { prisma } from "@/lib/db";

export const LEGACY_TENANT_TABLES = ["beneficiaries", "donors", "donations", "donation_campaigns", "projects", "news", "events", "tasks", "surveys", "documents"] as const;
export type LegacyTenantTable = (typeof LEGACY_TENANT_TABLES)[number];
export type LegacyTenantMapping = Readonly<{ table: LegacyTenantTable; recordId: string; organizationId: string; source: string; reason?: string }>;
export type BackfillCounters = Readonly<{ total: number; mapped: number; unmapped: number; orphan: number; ambiguous: number; conflict: number; unexpectedNull: number; invalidReference: number; updated: number; failed: number }>;
type MutableBackfillCounters = { total: number; mapped: number; unmapped: number; orphan: number; ambiguous: number; conflict: number; unexpectedNull: number; invalidReference: number; updated: number; failed: number };
export type TenantBackfillReport = Readonly<{ mode: "analyze" | "apply"; counters: BackfillCounters; rows: ReadonlyArray<LegacyTenantMapping>; blockers: ReadonlyArray<string> }>;

export class LegacyTenantBackfillError extends Error { constructor(public readonly code: "UNMAPPED_RECORD" | "ORPHAN_RECORD" | "AMBIGUOUS_MAPPING" | "CONFLICTING_PARENT_ORGANIZATION" | "INVALID_ORGANIZATION_REFERENCE" | "UNEXPECTED_NULL", message: string, public readonly report: TenantBackfillReport) { super(message); this.name = "LegacyTenantBackfillError"; } }
type RootRow = { id: string; organizationId: string | null };
type DonationOwnershipRow = RootRow & { donorId: string | null; campaignId: string | null; projectId: string | null; donorRecordId: string | null; campaignRecordId: string | null; projectRecordId: string | null; donorOrganizationId: string | null; campaignOrganizationId: string | null; projectOrganizationId: string | null };
const counters = (): MutableBackfillCounters => ({ total: 0, mapped: 0, unmapped: 0, orphan: 0, ambiguous: 0, conflict: 0, unexpectedNull: 0, invalidReference: 0, updated: 0, failed: 0 });
const hasBlocker = (c: BackfillCounters) => c.unmapped + c.orphan + c.ambiguous + c.conflict + c.unexpectedNull + c.invalidReference > 0;
const APPLY_ORDER: ReadonlyArray<LegacyTenantTable> = ["beneficiaries", "donors", "donation_campaigns", "projects", "news", "events", "tasks", "surveys", "documents", "donations"];
const errorFor = (report: TenantBackfillReport, message: string) => new LegacyTenantBackfillError(
  report.counters.orphan ? "ORPHAN_RECORD" : report.counters.ambiguous ? "AMBIGUOUS_MAPPING" : report.counters.conflict ? "CONFLICTING_PARENT_ORGANIZATION" : report.counters.invalidReference ? "INVALID_ORGANIZATION_REFERENCE" : report.counters.unexpectedNull ? "UNEXPECTED_NULL" : "UNMAPPED_RECORD",
  message,
  report,
);

export async function analyzeLegacyTenantBackfill(mappings: ReadonlyArray<LegacyTenantMapping>, client: typeof prisma = prisma): Promise<TenantBackfillReport> {
  const result = counters(); const blockers: string[] = []; const byRecord = new Map<string, LegacyTenantMapping[]>();
  for (const mapping of mappings) { const key = `${mapping.table}:${mapping.recordId}`; byRecord.set(key, [...(byRecord.get(key) ?? []), mapping]); }
  const organizationIds = new Set((await client.organization.findMany({ select: { id: true } })).map(({ id }) => id)); const rows: LegacyTenantMapping[] = []; const seenRecords = new Set<string>();
  const donationOwnership = new Map((await client.$queryRawUnsafe<DonationOwnershipRow[]>(`SELECT d."id", d."organizationId", d."donorId", d."campaignId", d."projectId", donor."id" AS "donorRecordId", campaign."id" AS "campaignRecordId", project."id" AS "projectRecordId", donor."organizationId" AS "donorOrganizationId", campaign."organizationId" AS "campaignOrganizationId", project."organizationId" AS "projectOrganizationId" FROM "donations" d LEFT JOIN "donors" donor ON donor."id" = d."donorId" LEFT JOIN "donation_campaigns" campaign ON campaign."id" = d."campaignId" LEFT JOIN "projects" project ON project."id" = d."projectId"`)).map((row) => [row.id, row]));
  for (const table of LEGACY_TENANT_TABLES) for (const record of await client.$queryRawUnsafe<RootRow[]>(`SELECT "id", "organizationId" FROM "${table}"`)) {
    result.total++; const recordKey = `${table}:${record.id}`; seenRecords.add(recordKey); const candidates = byRecord.get(recordKey) ?? [];
    if (record.organizationId && !organizationIds.has(record.organizationId)) { result.orphan++; blockers.push(`ORPHAN_RECORD:${table}:${record.id}`); continue; }
    if (!record.organizationId && candidates.length === 0) { result.unmapped++; blockers.push(`UNMAPPED_RECORD:${table}:${record.id}`); continue; }
    if (candidates.length !== 1) { result.ambiguous++; blockers.push(`AMBIGUOUS_MAPPING:${table}:${record.id}`); continue; }
    if (!organizationIds.has(candidates[0].organizationId)) { result.invalidReference++; blockers.push(`INVALID_ORGANIZATION_REFERENCE:${table}:${record.id}`); continue; }
    if (record.organizationId && record.organizationId !== candidates[0].organizationId) { result.conflict++; blockers.push(`CONFLICTING_PARENT_ORGANIZATION:${table}:${record.id}`); continue; }
    if (table === "donations") {
      const ownership = donationOwnership.get(record.id);
      const parents = ownership ? [["donors", ownership.donorId, ownership.donorRecordId, ownership.donorOrganizationId], ["donation_campaigns", ownership.campaignId, ownership.campaignRecordId, ownership.campaignOrganizationId], ["projects", ownership.projectId, ownership.projectRecordId, ownership.projectOrganizationId]] as const : [];
      if (parents.some(([, id, existingId]) => id !== null && existingId === null)) { result.orphan++; blockers.push(`ORPHAN_RECORD:${table}:${record.id}`); continue; }
      const parentMappings = parents.filter(([, id]) => id !== null).map(([parentTable, id]) => byRecord.get(`${parentTable}:${id}`) ?? []);
      if (parentMappings.some((items) => items.length === 0)) { result.unmapped++; blockers.push(`UNMAPPED_RECORD:${table}:${record.id}`); continue; }
      if (parentMappings.some((items) => items.length !== 1)) { result.ambiguous++; blockers.push(`AMBIGUOUS_MAPPING:${table}:${record.id}`); continue; }
      if (parentMappings.some(([mapping]) => mapping.organizationId !== candidates[0].organizationId)) { result.conflict++; blockers.push(`CONFLICTING_PARENT_ORGANIZATION:${table}:${record.id}`); continue; }
      if (parents.some(([, id, , storedOrganizationId]) => id !== null && storedOrganizationId !== null && storedOrganizationId !== candidates[0].organizationId)) { result.conflict++; blockers.push(`CONFLICTING_PARENT_ORGANIZATION:${table}:${record.id}`); continue; }
    }
    result.mapped++; rows.push(candidates[0]);
  }
  for (const key of byRecord.keys()) if (!seenRecords.has(key)) { result.unexpectedNull++; blockers.push(`UNEXPECTED_NULL:${key}`); }
  return { mode: "analyze", counters: result, rows, blockers };
}

export async function applyLegacyTenantBackfill(mappings: ReadonlyArray<LegacyTenantMapping>): Promise<TenantBackfillReport> {
  const analyzed = await analyzeLegacyTenantBackfill(mappings); if (hasBlocker(analyzed.counters)) throw errorFor(analyzed, "Legacy tenant backfill refused before write.");
  return prisma.$transaction(async (tx) => {
    const rechecked = await analyzeLegacyTenantBackfill(mappings, tx as typeof prisma); if (hasBlocker(rechecked.counters)) throw errorFor(rechecked, "Legacy tenant backfill changed during apply and was refused.");
    let updated = 0; const orderedRows = [...rechecked.rows].sort((left, right) => APPLY_ORDER.indexOf(left.table) - APPLY_ORDER.indexOf(right.table)); for (const row of orderedRows) updated += await tx.$executeRawUnsafe(`UPDATE "${row.table}" SET "organizationId" = $1 WHERE "id" = $2 AND "organizationId" IS NULL`, row.organizationId, row.recordId);
    const result = { ...rechecked, mode: "apply" as const, counters: { ...rechecked.counters, updated } };
    await tx.auditLog.create({ data: { action: "LEGACY_TENANT_BACKFILL_APPLIED", entity: "TenantBackfill", details: { counters: result.counters, mappings: result.rows } } }); return result;
  });
}
