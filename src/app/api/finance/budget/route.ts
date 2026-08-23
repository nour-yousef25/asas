import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantContext, TenantAuthorizationError } from "@/lib/tenant-context";
import { requirePermission, PolicyAuthorizationError } from "@/lib/policy";
import { budgetExpenseRepository } from "@/lib/budget-expense-repository";

const budgetSchema = z.object({
  title: z.string().min(2, "عنوان الميزانية مطلوب"),
  fiscalYear: z.string().min(2, "السنة المالية مطلوبة"),
  totalAmount: z.number().finite().positive("إجمالي الميزانية يجب أن يكون أكبر من صفر"),
  status: z.enum(["DRAFT", "APPROVED", "ACTIVE", "CLOSED"]).optional(),
});

export async function GET() {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "budget.read");
    const budgets = await budgetExpenseRepository.listBudgets(context);
    return NextResponse.json(budgets, { status: 200 });
  } catch (error) {
    if (error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    return NextResponse.json({ error: "تعذر تحميل الميزانيات" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "budget.create");
    const body = budgetSchema.parse(await request.json());
    const newBudget = await budgetExpenseRepository.createBudget(context, body);
    return NextResponse.json(newBudget, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
    return NextResponse.json({ error: "تعذر إنشاء الميزانية" }, { status: 500 });
  }
}
