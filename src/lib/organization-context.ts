/**
 * سياق الجمعية النشط — يمنع طبقات الاتصال الرقمي من قراءة أو كتابة بيانات جمعية أخرى.
 */
import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DEFAULT_ORGANIZATION_ID = "default-organization-id";

export type OrganizationContext = {
  organizationId: string;
  userId: string;
  role: Role;
};

export async function getOrganizationContext(): Promise<OrganizationContext> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("غير مصرح");

  // قد تبقى جلسة JWT من بيئة تطوير سابقة رغم تغير قاعدة البيانات المحلية.
  // لا تُنشأ عضوية إلا بعد استعادة مستخدم موجود محليًا بالمعرف أو البريد الموثوق في الجلسة.
  const localUser = await prisma.user.findUnique({ where: { id: session.user.id } })
    ?? (session.user.email ? await prisma.user.findUnique({ where: { email: session.user.email } }) : null);
  if (!localUser || !localUser.isActive) throw new Error("انتهت صلاحية الجلسة. سجّل الدخول مرة أخرى للمتابعة.");
  const localUserId = localUser.id;

  let membership = await prisma.organizationMembership.findFirst({
    where: { userId: localUserId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  // توافق آمن مع النسخة السابقة أحادية الجمعية فقط؛ لا ينشأ هذا العضو في جمعية جديدة.
  if (!membership) {
    const defaultOrganization = await prisma.organization.findUnique({ where: { id: DEFAULT_ORGANIZATION_ID } });
    if (!defaultOrganization) throw new Error("تعذر تحديد الجمعية النشطة.");
    membership = await prisma.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId: DEFAULT_ORGANIZATION_ID, userId: localUserId } },
      create: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        userId: localUserId,
        role: localUser.role,
        isDefault: true,
      },
      update: { isActive: true },
    });
  }

  return { organizationId: membership.organizationId, userId: localUserId, role: membership.role };
}

export function canManageCommunications(role: Role) {
  const allowed: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.EDITOR, Role.EMPLOYEE];
  return allowed.includes(role);
}

export function canApproveCommunications(role: Role) {
  const allowed: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];
  return allowed.includes(role);
}
