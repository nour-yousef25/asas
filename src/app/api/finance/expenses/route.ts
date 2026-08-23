import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantContext, TenantAuthorizationError } from "@/lib/tenant-context";
import { requirePermission, PolicyAuthorizationError } from "@/lib/policy";
import { budgetExpenseRepository, BudgetExpenseScopeError } from "@/lib/budget-expense-repository";

const expenseSchema = z.object({
  budgetItemId: z.string().min(1, "رقم بند الميزانية مطلوب"),
  title: z.string().min(2, "عنوان المصروف مطلوب"),
  description: z.string().optional(),
  amount: z.number().finite().positive("قيمة المصروف يجب أن تكون أكبر من صفر"),
  category: z.string().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "PAID"]).optional(),
  expenseDate: z.coerce.date().optional(),
  invoiceUrl: z.string().url().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "expense.read");
    const { searchParams } = new URL(request.url);
    const budgetItemId = searchParams.get("budgetItemId");
    if (!budgetItemId) return NextResponse.json({ error: "رقم بند الميزانية مفقود" }, { status: 400 });
    const expenses = await budgetExpenseRepository.listExpensesForBudgetItem(context, budgetItemId);
    return NextResponse.json(expenses, { status: 200 });
  } catch (error) {
    if (error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    return NextResponse.json({ error: "تعذر تحميل المصروفات" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "expense.create");
    const body = expenseSchema.parse(await request.json());
    const newExpense = await budgetExpenseRepository.createExpense(context, body);
    return NextResponse.json(newExpense, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    if (error instanceof BudgetExpenseScopeError) return NextResponse.json({ error: "العلاقة المالية غير متاحة ضمن المنظمة النشطة" }, { status: 403 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
    return NextResponse.json({ error: "تعذر إنشاء المصروف" }, { status: 500 });
  }
}
