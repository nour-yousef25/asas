import { PrismaClient, Budget, BudgetItem } from "@prisma/client";

const prisma = new PrismaClient();

export type BudgetCreateInput = Omit<Budget, 'id' | 'createdAt' | 'updatedAt' | 'spentAmount'> & {
  items: Omit<BudgetItem, 'id' | 'budgetId' | 'spent'>[];
};

/**
 * Creates a new budget along with its items.
 * @param data The data for the new budget and its items.
 * @returns The created budget with its items.
 */
export async function createBudget(data: BudgetCreateInput) {
  const { items, ...budgetData } = data;

  return prisma.budget.create({
    data: {
      ...budgetData,
      items: {
        create: items,
      },
    },
    include: {
      items: true,
    },
  });
}

/**
 * Retrieves all budgets with their items, ordered by fiscal year.
 * @returns A list of all budgets.
 */
export async function getAllBudgets() {
  return prisma.budget.findMany({
    include: {
      items: true,
    },
    orderBy: {
      fiscalYear: 'desc',
    },
  });
}

/**
 * Retrieves a single budget by its ID, including its items and related expenses.
 * @param id The ID of the budget to retrieve.
 * @returns The budget with details, or null if not found.
 */
export async function getBudgetDetails(id: string) {
  return prisma.budget.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          expenses: true,
        },
      },
    },
  });
}

/**
 * Deletes a budget and its associated items.
 * @param id The ID of the budget to delete.
 */
export async function deleteBudget(id: string) {
  // Using a transaction to ensure that both budget items and the budget itself are deleted.
  return prisma.$transaction([
    prisma.budgetItem.deleteMany({
      where: { budgetId: id },
    }),
    prisma.budget.delete({
      where: { id },
    }),
  ]);
}