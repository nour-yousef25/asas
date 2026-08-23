import type { BudgetStatus, ExpenseStatus, PrismaClient } from "@prisma/client";
import type { TenantContext } from "@/lib/tenant-context";
import { requireTenantBoundPrismaExecutor, type TenantBoundPrismaExecutor } from "@/lib/tenant-bound-prisma-authority";

export class BudgetExpenseScopeError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "FORBIDDEN_RELATION", message: string) {
    super(message);
    this.name = "BudgetExpenseScopeError";
  }
}

type BudgetCreateInput = { title: string; fiscalYear: string; totalAmount: number; status?: BudgetStatus };
type BudgetUpdateInput = Partial<BudgetCreateInput & { spentAmount: number }>;
type BudgetItemCreateInput = { budgetId: string; category: string; description?: string; allocated: number };
type ExpenseCreateInput = { budgetItemId: string; title: string; description?: string; amount: number; category?: string; status?: ExpenseStatus; expenseDate?: Date; invoiceUrl?: string };
type ExpenseUpdateInput = Partial<Omit<ExpenseCreateInput, "budgetItemId">>;

/**
 * W02 Budget/Expense data-plane contract:
 * tenant context -> Broker-issued tenant Prisma -> ownership-checked queries.
 * It intentionally has no global Prisma import and no application-selected tenant identity.
 */
export class BudgetExpenseRepository {
  constructor(private readonly executor?: TenantBoundPrismaExecutor) {}

  private execute<T>(context: TenantContext, operation: (db: PrismaClient) => Promise<T>) {
    return (this.executor ?? requireTenantBoundPrismaExecutor()).execute(context, operation);
  }

  private async auditDenied(context: TenantContext, action: string, entity: string, entityId: string) {
    await this.execute(context, (db) => db.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action,
        entity,
        entityId,
        details: { actorMembershipId: context.membershipId, decision: "DENY", reasonCode: "TENANT_SCOPE", correlationId: context.correlationId, source: "budget-expense-repository" },
      },
    }));
  }

  listBudgets(context: TenantContext) {
    return this.execute(context, (db) => db.budget.findMany({
      where: { organizationId: context.organizationId },
      include: { items: { where: { organizationId: context.organizationId }, orderBy: { category: "asc" } } },
      orderBy: [{ fiscalYear: "desc" }, { createdAt: "desc" }],
    }));
  }

  async getBudgetById(context: TenantContext, id: string) {
    const budget = await this.execute(context, (db) => db.budget.findFirst({
      where: { id, organizationId: context.organizationId },
      include: { items: { where: { organizationId: context.organizationId }, include: { expenses: { where: { organizationId: context.organizationId }, orderBy: { expenseDate: "desc" } } } } },
    }));
    if (!budget) await this.auditDenied(context, "TENANT_BUDGET_READ_DENIED", "Budget", id);
    return budget;
  }

  createBudget(context: TenantContext, input: BudgetCreateInput) {
    return this.execute(context, (db) => db.budget.create({ data: { ...input, organizationId: context.organizationId } }));
  }

  async updateBudget(context: TenantContext, id: string, input: BudgetUpdateInput) {
    const budget = await this.execute(context, (db) => db.budget.findFirst({ where: { id, organizationId: context.organizationId }, select: { id: true } }));
    if (!budget) {
      await this.auditDenied(context, "TENANT_BUDGET_UPDATE_DENIED", "Budget", id);
      return null;
    }
    return this.execute(context, (db) => db.budget.update({ where: { id: budget.id }, data: input }));
  }

  async deleteBudget(context: TenantContext, id: string) {
    const budget = await this.execute(context, (db) => db.budget.findFirst({ where: { id, organizationId: context.organizationId }, select: { id: true } }));
    if (!budget) {
      await this.auditDenied(context, "TENANT_BUDGET_DELETE_DENIED", "Budget", id);
      return null;
    }
    return this.execute(context, (db) => db.budget.delete({ where: { id: budget.id } }));
  }

  async addBudgetItem(context: TenantContext, input: BudgetItemCreateInput) {
    const budget = await this.execute(context, (db) => db.budget.findFirst({ where: { id: input.budgetId, organizationId: context.organizationId }, select: { id: true } }));
    if (!budget) {
      await this.auditDenied(context, "TENANT_BUDGET_ITEM_PARENT_DENIED", "Budget", input.budgetId);
      throw new BudgetExpenseScopeError("FORBIDDEN_RELATION", "الميزانية غير متاحة ضمن المنظمة النشطة.");
    }
    return this.execute(context, (db) => db.budgetItem.create({ data: { ...input, budgetId: budget.id, organizationId: context.organizationId } }));
  }

  private async findScopedBudgetItem(context: TenantContext, budgetItemId: string) {
    return this.execute(context, (db) => db.budgetItem.findFirst({
      where: { id: budgetItemId, organizationId: context.organizationId, budget: { organizationId: context.organizationId } },
      select: { id: true },
    }));
  }

  async listExpensesForBudgetItem(context: TenantContext, budgetItemId: string) {
    const item = await this.findScopedBudgetItem(context, budgetItemId);
    if (!item) {
      await this.auditDenied(context, "TENANT_EXPENSE_ITEM_READ_DENIED", "BudgetItem", budgetItemId);
      return [];
    }
    return this.execute(context, (db) => db.expense.findMany({
      where: { budgetItemId: item.id, organizationId: context.organizationId, budgetItem: { organizationId: context.organizationId, budget: { organizationId: context.organizationId } } },
      orderBy: { expenseDate: "desc" },
    }));
  }

  async createExpense(context: TenantContext, input: ExpenseCreateInput) {
    const item = await this.findScopedBudgetItem(context, input.budgetItemId);
    if (!item) {
      await this.auditDenied(context, "TENANT_EXPENSE_ITEM_WRITE_DENIED", "BudgetItem", input.budgetItemId);
      throw new BudgetExpenseScopeError("FORBIDDEN_RELATION", "بند الميزانية غير متاح ضمن المنظمة النشطة.");
    }
    return this.execute(context, (db) => db.expense.create({ data: { ...input, budgetItemId: item.id, organizationId: context.organizationId } }));
  }

  async updateExpense(context: TenantContext, id: string, input: ExpenseUpdateInput) {
    const expense = await this.execute(context, (db) => db.expense.findFirst({
      where: { id, organizationId: context.organizationId, budgetItem: { organizationId: context.organizationId, budget: { organizationId: context.organizationId } } },
      select: { id: true },
    }));
    if (!expense) {
      await this.auditDenied(context, "TENANT_EXPENSE_UPDATE_DENIED", "Expense", id);
      return null;
    }
    return this.execute(context, (db) => db.expense.update({ where: { id: expense.id }, data: input }));
  }

  async deleteExpense(context: TenantContext, id: string) {
    const expense = await this.execute(context, (db) => db.expense.findFirst({
      where: { id, organizationId: context.organizationId, budgetItem: { organizationId: context.organizationId, budget: { organizationId: context.organizationId } } },
      select: { id: true },
    }));
    if (!expense) {
      await this.auditDenied(context, "TENANT_EXPENSE_DELETE_DENIED", "Expense", id);
      return null;
    }
    return this.execute(context, (db) => db.expense.delete({ where: { id: expense.id } }));
  }
}

export const budgetExpenseRepository = new BudgetExpenseRepository();
