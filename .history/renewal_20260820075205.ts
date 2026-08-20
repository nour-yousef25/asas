import { PrismaClient, MembershipStatus, PaymentStatus } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * يجدد عضوية عضو معين.
 * @param memberId - معرف العضو المراد تجديد عضويته.
 * @param newExpiryDate - تاريخ انتهاء الصلاحية الجديد للعضوية.
 * @param paymentAmount - المبلغ المدفوع للتجديد.
 * @param paymentMethod - طريقة الدفع.
 * @returns بيانات العضو المحدثة.
 */
export async function renewMembership(
  memberId: string,
  newExpiryDate: Date,
  paymentAmount: number,
  paymentMethod: string
) {
  const updatedMember = await prisma.member.update({
    where: { id: memberId },
    data: {
      membershipExpiryDate: newExpiryDate,
      status: MembershipStatus.ACTIVE, // إعادة تفعيل العضوية عند التجديد
      paymentStatus: PaymentStatus.PAID,
      payments: {
        create: {
          amount: paymentAmount,
          paymentMethod: paymentMethod,
          status: PaymentStatus.PAID,
          paidAt: new Date(),
        },
      },
    },
  });

  return updatedMember;
}

/**
 * يقوم بتحديث حالة عضوية عضو معين.
 * @param memberId - معرف العضو.
 * @param newStatus - الحالة الجديدة للعضوية.
 * @returns بيانات العضو المحدثة.
 */
export async function updateMembershipStatus(memberId: string, newStatus: MembershipStatus) {
  return prisma.member.update({
    where: { id: memberId },
    data: { status: newStatus },
  });
}