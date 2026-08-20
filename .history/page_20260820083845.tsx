import { getAllBudgets } from "@/modules/finance/budget";
import { ExpenseForm } from "./_components/expense-form";

export default async function NewExpensePage() {
  // جلب الميزانيات المعتمدة والنشطة فقط لربط المصروفات بها
  const budgets = await getAllBudgets();
  const activeBudgets = budgets.filter(b => b.status === 'APPROVED' || b.status === 'ACTIVE');

  return (
    <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <ExpenseForm budgets={activeBudgets} />
    </main>
  );
}