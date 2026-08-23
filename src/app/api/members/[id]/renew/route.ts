import { NextRequest, NextResponse } from "next/server";
import { generateRandomNumber } from "@/lib/utils";
import { requireTenantContext } from "@/lib/tenant-context";
import { requirePermission } from "@/lib/policy";
import { memberKpiRepository } from "@/lib/member-kpi-repository";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireTenantContext();
  await requirePermission(context, "member.update");
  const { id } = await params;
  const body = await req.json();
  const payment = await memberKpiRepository.renewMember(context, id, { amount: parseFloat(body.amount), paymentMethod: body.paymentMethod, receiptNo: `R-${Date.now()}-${generateRandomNumber(4)}` });
  return NextResponse.json({ payment, success: true });
}
