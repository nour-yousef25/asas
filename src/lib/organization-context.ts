/**
 * سياق الجمعية النشط — يمنع طبقات الاتصال الرقمي من قراءة أو كتابة بيانات جمعية أخرى.
 */
import { Role } from "@prisma/client";
import { requireTenantContext } from "@/lib/tenant-context";

export type OrganizationContext = {
  organizationId: string;
  userId: string;
  role: Role;
};

export async function getOrganizationContext(): Promise<OrganizationContext> {
  const context = await requireTenantContext();
  return { organizationId: context.organizationId, userId: context.userId, role: context.role };
}

export function canManageCommunications(role: Role) {
  const allowed: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.EDITOR, Role.EMPLOYEE];
  return allowed.includes(role);
}

export function canApproveCommunications(role: Role) {
  const allowed: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];
  return allowed.includes(role);
}
