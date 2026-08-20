import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { generateRandomNumber } from "@/lib/utils";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const amount = parseFloat(body.amount);

  // تسجيل الدفعة
  const payment = await prisma.membershipPayment.create({
    data: {
      memberId: id,
      amount,
      paymentMethod: body.paymentMethod,
      receiptNo: `R-${Date.now()}-${generateRandomNumber(4)}`,
      status: "PAID",
      paidAt: new Date(),
    },
  });

  // تحديث العضوية
  const member = await prisma.member.findUnique({ where: { id } });
  if (member) {
    const newEndDate = member.endDate
      ? new Date(Math.max(member.endDate.getTime(), Date.now()) + 365 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await prisma.member.update({
      where: { id },
      data: {
        paidAmount: member.paidAmount + amount,
        paymentStatus: member.membershipFee <= member.paidAmount + amount ? "PAID" : "PARTIAL",
        endDate: newEndDate,
        status: "ACTIVE",
      },
    });
  }
  return NextResponse.json({ payment, success: true });
}
