import { NextRequest, NextResponse } from "next/server";
import * as ExpenseService from "@/src/modules/finance/expenses";

// استرجاع المصروفات المرتبطة ببند ميزانية معين
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const budgetItemId = searchParams.get("budgetItemId");

    if (!budgetItemId) {
      return NextResponse.json(
        { error: "رقم بند الميزانية مفقود" },
        { status: 400 }
      );
    }

    const expenses = await ExpenseService.getExpensesForBudgetItem(budgetItemId);
    return NextResponse.json(expenses, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// إضافة مصروف جديد
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const newExpense = await ExpenseService.createExpense(body);
    return NextResponse.json(newExpense, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}