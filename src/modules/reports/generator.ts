/**
 * منطق إنشاء التقارير.
 */
import { PrismaClient } from "@prisma/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const prisma = new PrismaClient();

/**
 * إنشاء تقرير مالي.
 */
export async function generateFinancialReport() {
  const budgets = await prisma.budget.findMany({
    include: { items: { include: { expenses: true } } },
  });

  // إعداد بيانات التقرير
  const reportData = budgets.map((budget) => {
    return {
      name: budget.name,
      totalAmount: budget.totalAmount,
      totalExpenses: budget.items.reduce(
        (sum, item) =>
          sum + item.expenses.reduce((itemSum, expense) => itemSum + expense.amount, 0),
        0
      ),
    };
  });

  // إنشاء PDF للتقرير
  const doc = new jsPDF();
  doc.text("التقرير المالي", 10, 10);
  autoTable(doc, {
    head: [["اسم الميزانية", "المبلغ الكلي", "إجمالي المصروفات"]],
    body: reportData.map((budget) => [
      budget.name,
      budget.totalAmount.toFixed(2),
      budget.totalExpenses.toFixed(2),
    ]),
  });

  return doc.save("financial-report.pdf"); // يمكن التكيف حسب الحاجة
}

/**
 * إنشاء تقرير تبرعات.
 */
export async function generateDonationsReport() {
  const donations = await prisma.donation.findMany();

  // إعداد بيانات التقرير
  const reportData = donations.map((donation) => {
    return {
      donor: donation.donorName,
      amount: donation.amount,
      date: donation.date.toISOString().split("T")[0],
    };
  });

  // إنشاء PDF للتقرير
  const doc = new jsPDF();
  doc.text("تقرير التبرعات", 10, 10);
  autoTable(doc, {
    head: [["المتبرع", "المبلغ", "التاريخ"]],
    body: reportData.map((donation) => [
      donation.donor,
      donation.amount.toFixed(2),
      donation.date,
    ]),
  });

  return doc.save("donations-report.pdf");
}