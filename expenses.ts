import { PrismaClient, Expense, ExpenseStatus } from "@prisma/client";

const prisma = new PrismaClient();

export type ExpenseCreateInput = Omit<Expense, 'id' | 'status' | 'approvedById'>;

/**
 * Creates a new expense and updates the corresponding budget item and budget totals.
 * This operation is transactional.
 * @param data The data for the new expense.
 * @returns The created expense.
 */
export async function createExpense(data: ExpenseCreateInput) {
  const { budgetItemId, amount, ...expenseData } = data;

  if (!budgetItemId) {
    // Create an expense without linking it to a budget
    return prisma.expense.create({
      data: {
        ...expenseData,
        amount,
        status: ExpenseStatus.PENDING,
      },
    });
  }

  // Use a transaction to ensure data integrity
  const [expense] = await prisma.$transaction(async (tx) => {
    const budgetItem = await tx.budgetItem.findUnique({
      where: { id: budgetItemId },
      select: { budgetId: true },
    });

    if (!budgetItem) {
      throw new Error("Budget item not found.");
    }

    const newExpense = await tx.expense.create({
      data: {
        ...expenseData,
        amount,
        budgetItemId,
        status: ExpenseStatus.PAID, // Assuming direct payment for simplicity
      },
    });

    // Update the spent amount on the budget item
    await tx.budgetItem.update({
      where: { id: budgetItemId },
      data: { spent: { increment: amount } },
    });

    // Update the spent amount on the main budget
    await tx.budget.update({
      where: { id: budgetItem.budgetId },
      data: { spentAmount: { increment: amount } },
    });

    return [newExpense];
  });

  return expense;
}

/**
 * Retrieves all expenses, ordered by date.
 * @returns A list of all expenses.
 */
export async function getAllExpenses() {
  return prisma.expense.findMany({
    orderBy: {
      expenseDate: 'desc',
    },
    include: {
      budgetItem: true,
    },
  });
}