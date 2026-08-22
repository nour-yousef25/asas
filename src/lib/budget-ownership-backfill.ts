import { prisma } from "@/lib/db";

export type BudgetOwnershipManifestEntry = Readonly<{
  table: "Budget";
  recordId: string;
  organizationId: string;
  source: string;
  reason?: string;
}>;

export type BudgetOwnershipReport = Readonly<{
  total: number;
  mapped: number;
  unmapped: number;
  orphan: number;
  ambiguous: number;
  conflict: number;
  invalidReference: number;
  unexpectedNull: number;
  updated: number;
  blockers: readonly string[];
}>;

export class BudgetOwnershipBlockedError extends Error {
  constructor(readonly report: BudgetOwnershipReport) {
    super(`Budget ownership backfill blocked: ${report.blockers.join(", ") || "unknown"}`);
    this.name = "BudgetOwnershipBlockedError";
  }
}

const emptyReport = (): BudgetOwnershipReport => ({ total: 0, mapped: 0, unmapped: 0, orphan: 0, ambiguous: 0, conflict: 0, invalidReference: 0, unexpectedNull: 0, updated: 0, blockers: [] });

type MutableBudgetOwnershipReport = {
  total: number;
  mapped: number;
  unmapped: number;
  orphan: number;
  ambiguous: number;
  conflict: number;
  invalidReference: number;
  unexpectedNull: number;
  updated: number;
  blockers: string[];
};

export async function analyzeBudgetOwnership(manifest: readonly BudgetOwnershipManifestEntry[]): Promise<BudgetOwnershipReport> {
  const budgets = await prisma.budget.findMany({ include: { items: { include: { expenses: true } } } });
  const organizations = new Set((await prisma.organization.findMany({ select: { id: true } })).map((organization) => organization.id));
  const byBudget = new Map<string, BudgetOwnershipManifestEntry[]>();
  for (const entry of manifest) byBudget.set(entry.recordId, [...(byBudget.get(entry.recordId) ?? []), entry]);
  const report: MutableBudgetOwnershipReport = { ...emptyReport(), blockers: [] };
  report.total = budgets.reduce((count, budget) => count + 1 + budget.items.length + budget.items.reduce((inner, item) => inner + item.expenses.length, 0), 0);
  for (const budget of budgets) {
    const entries = byBudget.get(budget.id) ?? [];
    if (entries.length === 0) { report.unmapped += 1; report.blockers.push(`UNMAPPED_BUDGET:${budget.id}`); continue; }
    if (entries.length !== 1) { report.ambiguous += 1; report.blockers.push(`AMBIGUOUS_BUDGET:${budget.id}`); continue; }
    const entry = entries[0];
    if (!organizations.has(entry.organizationId)) { report.invalidReference += 1; report.blockers.push(`INVALID_ORGANIZATION:${budget.id}`); continue; }
    if (budget.organizationId && budget.organizationId !== entry.organizationId) { report.conflict += 1; report.blockers.push(`BUDGET_CONFLICT:${budget.id}`); continue; }
    report.mapped += 1;
    for (const item of budget.items) {
      if (item.organizationId && item.organizationId !== entry.organizationId) { report.conflict += 1; report.blockers.push(`ITEM_CONFLICT:${item.id}`); }
      for (const expense of item.expenses) {
        if (expense.organizationId && expense.organizationId !== entry.organizationId) { report.conflict += 1; report.blockers.push(`EXPENSE_CONFLICT:${expense.id}`); }
      }
    }
  }
  const budgetIds = new Set(budgets.map((budget) => budget.id));
  for (const entry of manifest) {
    if (!budgetIds.has(entry.recordId)) {
      report.invalidReference += 1;
      report.blockers.push(`UNKNOWN_BUDGET:${entry.recordId}`);
    }
  }
  const items = await prisma.budgetItem.findMany({ include: { expenses: true } });
  for (const item of items) {
    if (!budgetIds.has(item.budgetId)) { report.orphan += 1; report.blockers.push(`ORPHAN_ITEM:${item.id}`); }
  }
  const itemIds = new Set(items.map((item) => item.id));
  const expenses = await prisma.expense.findMany();
  for (const expense of expenses) {
    if (!expense.budgetItemId || !itemIds.has(expense.budgetItemId)) { report.orphan += 1; report.blockers.push(`ORPHAN_EXPENSE:${expense.id}`); }
  }
  return report;
}

export async function applyBudgetOwnership(manifest: readonly BudgetOwnershipManifestEntry[]): Promise<BudgetOwnershipReport> {
  const analysis = await analyzeBudgetOwnership(manifest);
  if (analysis.blockers.length > 0) throw new BudgetOwnershipBlockedError(analysis);
  return prisma.$transaction(async (tx) => {
    const fresh = await analyzeBudgetOwnership(manifest);
    if (fresh.blockers.length > 0) throw new BudgetOwnershipBlockedError(fresh);
    let updated = 0;
    for (const entry of manifest) {
      const budget = await tx.budget.findUnique({ where: { id: entry.recordId }, include: { items: { include: { expenses: true } } } });
      if (!budget) throw new BudgetOwnershipBlockedError({ ...fresh, invalidReference: fresh.invalidReference + 1, blockers: [...fresh.blockers, `MISSING_BUDGET:${entry.recordId}`] });
      await tx.budget.update({ where: { id: budget.id }, data: { organizationId: entry.organizationId } }); updated += 1;
      for (const item of budget.items) {
        await tx.budgetItem.update({ where: { id: item.id }, data: { organizationId: entry.organizationId } }); updated += 1;
        for (const expense of item.expenses) { await tx.expense.update({ where: { id: expense.id }, data: { organizationId: entry.organizationId } }); updated += 1; }
      }
      await tx.auditLog.create({ data: { organizationId: entry.organizationId, action: "BUDGET_OWNERSHIP_BACKFILL_APPLIED", entity: "Budget", entityId: budget.id, details: { source: entry.source, reason: entry.reason ?? null, decision: "APPLY" } } });
    }
    const [budgetNulls, itemNulls, expenseNulls] = await Promise.all([
      tx.budget.count({ where: { id: { in: manifest.map((entry) => entry.recordId) }, organizationId: null } }),
      tx.budgetItem.count({ where: { budgetId: { in: manifest.map((entry) => entry.recordId) }, organizationId: null } }),
      tx.expense.count({ where: { budgetItem: { budgetId: { in: manifest.map((entry) => entry.recordId) } }, organizationId: null } }),
    ]);
    const unexpectedNull = budgetNulls + itemNulls + expenseNulls;
    if (unexpectedNull > 0) throw new BudgetOwnershipBlockedError({ ...fresh, unexpectedNull, blockers: [...fresh.blockers, "UNEXPECTED_NULL_AFTER_APPLY"] });
    return { ...fresh, updated, unexpectedNull };
  });
}
