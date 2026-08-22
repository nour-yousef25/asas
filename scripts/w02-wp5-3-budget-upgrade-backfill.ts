import { prisma } from "@/lib/db";
import { analyzeBudgetOwnership, applyBudgetOwnership } from "@/lib/budget-ownership-backfill";

const manifest = [
  { table: "Budget" as const, recordId: "w02wp53upbudgeta", organizationId: "w02wp53uporga", source: "pre-wp5-3-audit-fixture" },
  { table: "Budget" as const, recordId: "w02wp53upbudgetb", organizationId: "w02wp53uporgb", source: "pre-wp5-3-audit-fixture" },
];

async function main() {
  const before = await analyzeBudgetOwnership(manifest);
  if (before.blockers.length > 0) throw new Error(`UPGRADE_ANALYZE_BLOCKED:${before.blockers.join(",")}`);
  const applied = await applyBudgetOwnership(manifest);
  const rows = await Promise.all([
    prisma.budget.findMany({ where: { id: { in: manifest.map((entry) => entry.recordId) } }, select: { id: true, organizationId: true } }),
    prisma.budgetItem.findMany({ where: { id: { in: ["w02wp53upitema", "w02wp53upitemb"] } }, select: { id: true, organizationId: true, budgetId: true } }),
    prisma.expense.findMany({ where: { id: { in: ["w02wp53upexpensea", "w02wp53upexpenseb"] } }, select: { id: true, organizationId: true, budgetItemId: true } }),
  ]);
  const allAssigned = rows.flat().every((row) => row.organizationId === "w02wp53uporga" || row.organizationId === "w02wp53uporgb");
  console.log(JSON.stringify({ runId: `W02-WP5-3-UPGRADE-${new Date().toISOString()}`, status: allAssigned && applied.updated === 6 ? "PASS" : "FAIL", before, applied, rows }));
  await prisma.$disconnect();
  process.exit(allAssigned && applied.updated === 6 ? 0 : 1);
}
main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
