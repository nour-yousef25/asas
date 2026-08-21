/**
 * وظائف إدارة المصروفات.
 */
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type ExpenseCreateInput = Prisma.ExpenseUncheckedCreateInput;

/**
 * إضافة مصروف جديد.
 */
export async function createExpense(data: ExpenseCreateInput) {
  return prisma.expense.create({
    data,
  });
}

/**
 * جلب جميع المصروفات المرتبطة ببند ميزانية معين.
 */
export async function getExpensesForBudgetItem(budgetItemId: string) {
  return prisma.expense.findMany({
    where: { budgetItemId },
  });
}

/**
 * تحديث مصروف معين.
 */
export async function updateExpense(id: string, data: Prisma.ExpenseUncheckedUpdateInput) {
  return prisma.expense.update({
    where: { id },
    data,
  });
}

/**
 * حذف مصروف معين.
 */
export async function deleteExpense(id: string) {
  return prisma.expense.delete({
    where: { id },
  });
}
