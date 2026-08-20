import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Generates a summary financial report for a given period.
 * @param startDate The start date of the report period.
 * @param endDate The end date of the report period.
 * @returns An object containing financial summary data.
 */
export async function generateFinancialReport(startDate: Date, endDate: Date) {
  const totalDonations = await prisma.donation.aggregate({
    _sum: {
      amount: true,
    },
    where: {
      status: 'COMPLETED',
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const totalExpenses = await prisma.expense.aggregate({
    _sum: {
      amount: true,
    },
    where: {
      status: 'PAID',
      expenseDate: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const expensesByCategory = await prisma.expense.groupBy({
    by: ['category'],
    _sum: {
      amount: true,
    },
    where: {
      status: 'PAID',
      expenseDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      _sum: {
        amount: 'desc',
      }
    }
  });

  return {
    startDate,
    endDate,
    totalRevenue: totalDonations._sum.amount || 0,
    totalExpenses: totalExpenses._sum.amount || 0,
    netResult: (totalDonations._sum.amount || 0) - (totalExpenses._sum.amount || 0),
    expensesBreakdown: expensesByCategory.map(item => ({
      category: item.category || 'غير مصنف',
      total: item._sum.amount || 0,
    })),
  };
}

/**
 * Generates a donations report for a given period.
 * @param startDate The start date of the report period.
 * @param endDate The end date of the report period.
 * @returns A list of donations within the period.
 */
export async function generateDonationsReport(startDate: Date, endDate: Date) {
  return prisma.donation.findMany({
    where: {
      status: 'COMPLETED',
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      donor: true,
      campaign: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}