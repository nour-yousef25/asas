import { NextRequest, NextResponse } from "next/server";
import * as BudgetService from "@/src/modules/finance/budget";

// الحصول على جميع الميزانيات
export async function GET() {
  try {
    const budgets = await BudgetService.getAllBudgets();
    return NextResponse.json(budgets, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// إنشاء ميزانية جديدة
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const newBudget = await BudgetService.createBudget(body);
    return NextResponse.json(newBudget, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}