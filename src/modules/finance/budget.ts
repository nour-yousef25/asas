/**
 * وظائف إدارة الميزانية.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type BudgetCreateInput = {
  name: string;
  totalAmount: number;
};

export type BudgetItemCreateInput = {
  budgetId: string;
  name: string;
  amount: number;
};

/**
 * إنشاء ميزانية جديدة.
 */
export async function createBudget(data: BudgetCreateInput) {
  return prisma.budget.create({
    data,
  });
}

/**
 * إضافة بند جديد إلى ميزانية موجودة.
 */
export async function addBudgetItem(data: BudgetItemCreateInput) {
  return prisma.budgetItem.create({
    data,
  });
}

/**
 * استرجاع جميع الميزانيات.
 */
export async function getAllBudgets() {
  return prisma.budget.findMany({
    include: {
      items: true, // تضمين البنود المرتبطة بالميزانية
    },
  });
}

/**
 * تحديث ميزانية موجودة.
 */
export async function updateBudget(id: string, data: Partial<BudgetCreateInput>) {
  return prisma.budget.update({
    where: { id },
    data,
  });
}

/**
 * حذف ميزانية.
 */
export async function deleteBudget(id: string) {
  return prisma.budget.delete({
    where: { id },
  });
}
