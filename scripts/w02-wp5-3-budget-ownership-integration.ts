import { prisma } from "@/lib/db";
import { analyzeBudgetOwnership, applyBudgetOwnership, BudgetOwnershipBlockedError, type BudgetOwnershipManifestEntry } from "@/lib/budget-ownership-backfill";

type Check = { name: string; status: "PASS" | "FAIL"; detail: string };
const checks: Check[] = [];
const record = (name: string, ok: boolean, detail: string) => checks.push({ name, status: ok ? "PASS" : "FAIL", detail });

async function expectBlocked(name: string, work: () => Promise<unknown>, expected: string) {
  try { await work(); record(name, false, "apply/analyze unexpectedly succeeded"); }
  catch (error) { record(name, error instanceof BudgetOwnershipBlockedError && error.report.blockers.some((item) => item.includes(expected)), error instanceof BudgetOwnershipBlockedError ? error.report.blockers.join(",") : "non-contract-error"); }
}

async function main() {
  const suffix = Date.now().toString(36);
  const orgA = await prisma.organization.create({ data: { name: `WP5-3 Budget A ${suffix}` } });
  const orgB = await prisma.organization.create({ data: { name: `WP5-3 Budget B ${suffix}` } });
  const roots = await Promise.all([orgA, orgB].map(async (organization) => {
    const budget = await prisma.budget.create({ data: { title: `Budget ${organization.name}`, fiscalYear: "2026", totalAmount: 1000 } });
    const item = await prisma.budgetItem.create({ data: { budgetId: budget.id, category: "Operations", allocated: 1000 } });
    const expense = await prisma.expense.create({ data: { title: `Expense ${organization.name}`, amount: 100, budgetItemId: item.id } });
    return { organization, budget, item, expense };
  }));
  const manifest: BudgetOwnershipManifestEntry[] = roots.map(({ organization, budget }) => ({ table: "Budget", recordId: budget.id, organizationId: organization.id, source: "audit-fixture" }));
  try {
    const analysis = await analyzeBudgetOwnership(manifest);
    record("ANALYZE_A_B_GRAPH", analysis.mapped === 2 && analysis.blockers.length === 0, JSON.stringify(analysis));
    const applied = await applyBudgetOwnership(manifest);
    record("APPLY_A_B_GRAPH", applied.updated === 6 && applied.unexpectedNull === 0, JSON.stringify(applied));
    const after = await Promise.all(roots.map(async ({ budget, item, expense, organization }) => ({ budget: await prisma.budget.findUnique({ where: { id: budget.id } }), item: await prisma.budgetItem.findUnique({ where: { id: item.id } }), expense: await prisma.expense.findUnique({ where: { id: expense.id } }), organization })));
    record("TWO_ORG_ISOLATION", after.every(({ budget, item, expense, organization }) => budget?.organizationId === organization.id && item?.organizationId === organization.id && expense?.organizationId === organization.id), "A/B ownership remains graph-consistent");

    const unmapped = await prisma.budget.create({ data: { title: `Unmapped ${suffix}`, fiscalYear: "2026", totalAmount: 1 } });
    await expectBlocked("UNMAPPED_REJECTED", () => applyBudgetOwnership(manifest), "UNMAPPED_BUDGET");
    record("UNMAPPED_NO_WRITE", (await prisma.budget.findUnique({ where: { id: unmapped.id } }))?.organizationId === null, "unmapped root remains null");
    await prisma.budget.delete({ where: { id: unmapped.id } });

    const duplicate = await prisma.budget.create({ data: { title: `Duplicate ${suffix}`, fiscalYear: "2026", totalAmount: 1 } });
    const ambiguous = await analyzeBudgetOwnership([...manifest, { table: "Budget", recordId: duplicate.id, organizationId: orgA.id, source: "x" }, { table: "Budget", recordId: duplicate.id, organizationId: orgB.id, source: "y" }]);
    record("AMBIGUOUS_REJECTED", ambiguous.ambiguous === 1 && ambiguous.blockers.some((item) => item.includes("AMBIGUOUS_BUDGET")), ambiguous.blockers.join(","));
    await expectBlocked("INVALID_ORG_REJECTED", () => applyBudgetOwnership([...manifest, { table: "Budget", recordId: duplicate.id, organizationId: "missing-org", source: "x" }]), "INVALID_ORGANIZATION");
    await prisma.budget.delete({ where: { id: duplicate.id } });

    const orphan = await prisma.expense.create({ data: { title: `Orphan ${suffix}`, amount: 1 } });
    await expectBlocked("ORPHAN_REJECTED", () => applyBudgetOwnership(manifest), "ORPHAN_EXPENSE");
    await prisma.expense.delete({ where: { id: orphan.id } });

    const conflict = await prisma.budget.create({ data: { title: `Conflict ${suffix}`, fiscalYear: "2026", totalAmount: 1, organizationId: orgA.id } });
    const conflictItem = await prisma.budgetItem.create({ data: { budgetId: conflict.id, category: "Conflict", allocated: 1, organizationId: orgB.id } });
    await expectBlocked("PARENT_CHILD_CONFLICT_REJECTED", () => applyBudgetOwnership([...manifest, { table: "Budget", recordId: conflict.id, organizationId: orgA.id, source: "x" }]), "ITEM_CONFLICT");
    await prisma.budgetItem.delete({ where: { id: conflictItem.id } });
    await prisma.budget.delete({ where: { id: conflict.id } });

    const rollback = await prisma.budget.create({ data: { title: `Rollback ${suffix}`, fiscalYear: "2026", totalAmount: 1 } });
    const rollbackItem = await prisma.budgetItem.create({ data: { budgetId: rollback.id, category: "Rollback", allocated: 1 } });
    const rollbackExpense = await prisma.expense.create({ data: { title: `Rollback ${suffix}`, amount: 1, budgetItemId: rollbackItem.id } });
    await prisma.$executeRawUnsafe("CREATE OR REPLACE FUNCTION w02_budget_item_fail() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'w02 injected budget item failure'; END; $$ LANGUAGE plpgsql;");
    await prisma.$executeRawUnsafe("CREATE TRIGGER w02_budget_item_fail_trigger BEFORE UPDATE OF \"organizationId\" ON \"budget_items\" FOR EACH ROW EXECUTE FUNCTION w02_budget_item_fail();");
    try { await applyBudgetOwnership([...manifest, { table: "Budget", recordId: rollback.id, organizationId: orgA.id, source: "failure-injection" }]); record("FAILURE_INJECTION", false, "unexpected success"); }
    catch { record("FAILURE_INJECTION", true, "trigger rejected child update"); }
    await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS w02_budget_item_fail_trigger ON \"budget_items\";");
    await prisma.$executeRawUnsafe("DROP FUNCTION IF EXISTS w02_budget_item_fail();");
    const rollbackRows = await Promise.all([prisma.budget.findUnique({ where: { id: rollback.id } }), prisma.budgetItem.findUnique({ where: { id: rollbackItem.id } }), prisma.expense.findUnique({ where: { id: rollbackExpense.id } })]);
    record("ATOMIC_ROLLBACK", rollbackRows.every((row) => row?.organizationId === null), "root/child/grandchild remained null after injected failure");
  } finally {
    await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS w02_budget_item_fail_trigger ON \"budget_items\";");
    await prisma.$executeRawUnsafe("DROP FUNCTION IF EXISTS w02_budget_item_fail();");
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.expense.deleteMany({ where: { title: { contains: suffix } } });
    await prisma.budgetItem.deleteMany({ where: { budget: { title: { contains: suffix } } } });
    await prisma.budget.deleteMany({ where: { title: { contains: suffix } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  }
  const status = checks.every((check) => check.status === "PASS") ? "PASS" : "FAIL";
  console.log(JSON.stringify({ runId: `W02-WP5-3-BUDGET-${new Date().toISOString()}`, status, checks }));
  await prisma.$disconnect(); process.exit(status === "PASS" ? 0 : 1);
}
main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
