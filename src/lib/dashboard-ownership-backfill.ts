import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

export type DashboardOwnershipManifestEntry = Readonly<{
  table: "Member" | "KPI";
  recordId: string;
  organizationId: string;
  source: string;
  reason?: string;
}>;

export type DashboardOwnershipReport = Readonly<{
  total: number;
  mapped: number;
  unmapped: number;
  ambiguous: number;
  conflict: number;
  invalidReference: number;
  unexpectedNull: number;
  updated: number;
  blockers: readonly string[];
}>;

export class DashboardOwnershipBlockedError extends Error {
  constructor(readonly report: DashboardOwnershipReport) {
    super(`Dashboard ownership backfill blocked: ${report.blockers.join(", ") || "unknown"}`);
  }
}

type MutableReport = {
  total: number;
  mapped: number;
  unmapped: number;
  ambiguous: number;
  conflict: number;
  invalidReference: number;
  unexpectedNull: number;
  updated: number;
  blockers: string[];
};
const emptyReport = (): MutableReport => ({ total: 0, mapped: 0, unmapped: 0, ambiguous: 0, conflict: 0, invalidReference: 0, unexpectedNull: 0, updated: 0, blockers: [] });

function entryKey(entry: DashboardOwnershipManifestEntry) {
  return `${entry.table}:${entry.recordId}`;
}

/**
 * Control-plane ownership backfill only. It never infers ownership from
 * activeOrganizationId, memberships, KPI target fields, client input, or a default tenant.
 */
export async function analyzeDashboardOwnership(manifest: readonly DashboardOwnershipManifestEntry[], client: PrismaClient = prisma): Promise<DashboardOwnershipReport> {
  const [members, kpis, organizations] = await Promise.all([
    client.member.findMany({ select: { id: true, organizationId: true } }),
    client.kPI.findMany({ select: { id: true, organizationId: true, records: { select: { id: true, organizationId: true } } } }),
    client.organization.findMany({ select: { id: true } }),
  ]);
  const knownOrganizations = new Set(organizations.map((organization) => organization.id));
  const entries = new Map<string, DashboardOwnershipManifestEntry[]>();
  for (const entry of manifest) entries.set(entryKey(entry), [...(entries.get(entryKey(entry)) ?? []), entry]);
  const report = emptyReport();
  report.total = members.length + kpis.length + kpis.reduce((sum, kpi) => sum + kpi.records.length, 0);

  const evaluate = (table: DashboardOwnershipManifestEntry["table"], id: string, existingOrganizationId: string | null) => {
    const matches = entries.get(`${table}:${id}`) ?? [];
    if (matches.length === 0) { report.unmapped += 1; report.blockers.push(`UNMAPPED_${table.toUpperCase()}:${id}`); return undefined; }
    if (matches.length !== 1) { report.ambiguous += 1; report.blockers.push(`AMBIGUOUS_${table.toUpperCase()}:${id}`); return undefined; }
    const entry = matches[0];
    if (!knownOrganizations.has(entry.organizationId)) { report.invalidReference += 1; report.blockers.push(`INVALID_ORGANIZATION:${table}:${id}`); return undefined; }
    if (existingOrganizationId && existingOrganizationId !== entry.organizationId) { report.conflict += 1; report.blockers.push(`CONFLICT_${table.toUpperCase()}:${id}`); return undefined; }
    report.mapped += 1;
    return entry;
  };

  for (const member of members) evaluate("Member", member.id, member.organizationId);
  for (const kpi of kpis) {
    const entry = evaluate("KPI", kpi.id, kpi.organizationId);
    if (!entry) continue;
    for (const record of kpi.records) {
      if (record.organizationId && record.organizationId !== entry.organizationId) {
        report.conflict += 1;
        report.blockers.push(`CONFLICT_KPI_RECORD:${record.id}`);
      }
    }
  }

  const knownKeys = new Set([...members.map((member) => `Member:${member.id}`), ...kpis.map((kpi) => `KPI:${kpi.id}`)]);
  for (const entry of manifest) {
    if (!knownKeys.has(entryKey(entry))) {
      report.invalidReference += 1;
      report.blockers.push(`UNKNOWN_${entry.table.toUpperCase()}:${entry.recordId}`);
    }
  }
  return report;
}

export async function applyDashboardOwnership(manifest: readonly DashboardOwnershipManifestEntry[], client: PrismaClient = prisma): Promise<DashboardOwnershipReport> {
  const analysis = await analyzeDashboardOwnership(manifest, client);
  if (analysis.blockers.length > 0) throw new DashboardOwnershipBlockedError(analysis);
  return client.$transaction(async (tx) => {
    const fresh = await analyzeDashboardOwnership(manifest, tx as PrismaClient);
    if (fresh.blockers.length > 0) throw new DashboardOwnershipBlockedError(fresh);
    let updated = 0;
    for (const entry of manifest) {
      if (entry.table === "Member") {
        await tx.member.update({ where: { id: entry.recordId }, data: { organizationId: entry.organizationId } });
        updated += 1;
      } else {
        const kpi = await tx.kPI.findUnique({ where: { id: entry.recordId }, include: { records: { select: { id: true } } } });
        if (!kpi) throw new DashboardOwnershipBlockedError({ ...fresh, invalidReference: fresh.invalidReference + 1, blockers: [...fresh.blockers, `MISSING_KPI:${entry.recordId}`] });
        await tx.kPI.update({ where: { id: kpi.id }, data: { organizationId: entry.organizationId } });
        updated += 1;
        for (const record of kpi.records) {
          await tx.kPIRecord.update({ where: { id: record.id }, data: { organizationId: entry.organizationId } });
          updated += 1;
        }
      }
      await tx.auditLog.create({ data: { organizationId: entry.organizationId, action: "DASHBOARD_OWNERSHIP_BACKFILL_APPLIED", entity: entry.table, entityId: entry.recordId, details: { source: entry.source, reason: entry.reason ?? null, decision: "APPLY" } } });
    }
    const memberIds = manifest.filter((entry) => entry.table === "Member").map((entry) => entry.recordId);
    const kpiIds = manifest.filter((entry) => entry.table === "KPI").map((entry) => entry.recordId);
    const [memberNulls, kpiNulls, recordNulls] = await Promise.all([
      tx.member.count({ where: { id: { in: memberIds }, organizationId: null } }),
      tx.kPI.count({ where: { id: { in: kpiIds }, organizationId: null } }),
      tx.kPIRecord.count({ where: { kpiId: { in: kpiIds }, organizationId: null } }),
    ]);
    const unexpectedNull = memberNulls + kpiNulls + recordNulls;
    if (unexpectedNull > 0) throw new DashboardOwnershipBlockedError({ ...fresh, unexpectedNull, blockers: [...fresh.blockers, "UNEXPECTED_NULL_AFTER_APPLY"] });
    return { ...fresh, updated, unexpectedNull };
  });
}
