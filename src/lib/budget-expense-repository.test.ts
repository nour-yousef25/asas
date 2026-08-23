import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Budget/Expense tenant cutover structural guards", () => {
  it("requires tenant-bound Prisma and does not retain local/global Prisma access in the legacy modules", () => {
    const repository = source("src/lib/budget-expense-repository.ts");
    const budgetModule = source("src/modules/finance/budget.ts");
    const expenseModule = source("src/modules/finance/expenses.ts");
    expect(repository).not.toMatch(/from "@\/lib\/db"|current_setting|set_config|DATABASE_URL/);
    expect(repository).toMatch(/requireTenantBoundPrismaExecutor/);
    expect(repository).toMatch(/TenantBoundPrismaExecutor/);
    expect(budgetModule).not.toMatch(/new PrismaClient|from "@prisma\/client"/);
    expect(expenseModule).not.toMatch(/new PrismaClient|from "@prisma\/client"/);
  });

  it("uses server TenantContext and semantic permissions on Budget/Expense API paths", () => {
    const budgetRoute = source("src/app/api/finance/budget/route.ts");
    const expenseRoute = source("src/app/api/finance/expenses/route.ts");
    expect(budgetRoute).toMatch(/requireTenantContext/);
    expect(budgetRoute).toMatch(/requirePermission\(context, "budget\.read"\)/);
    expect(budgetRoute).toMatch(/requirePermission\(context, "budget\.create"\)/);
    expect(budgetRoute).toMatch(/budgetExpenseRepository\.listBudgets/);
    expect(expenseRoute).toMatch(/requireTenantContext/);
    expect(expenseRoute).toMatch(/requirePermission\(context, "expense\.read"\)/);
    expect(expenseRoute).toMatch(/requirePermission\(context, "expense\.create"\)/);
    expect(expenseRoute).toMatch(/budgetExpenseRepository\.listExpensesForBudgetItem/);
  });
});
