import { PermissionEffect, Role } from "@prisma/client";
import { assignOrganizationRole, IamAuthorizationError, setMembershipPermissionOverride } from "@/lib/iam";
import { prisma } from "@/lib/db";
import { evaluatePermission, hasApprovedSupportReadAccess } from "@/lib/policy";
import { resolveTenantContextForUser } from "@/lib/tenant-context";

type Check = { name: string; status: "PASS" | "FAIL"; detail: string };
const checks: Check[] = [];
const record = (name: string, ok: boolean, detail: string) => checks.push({ name, status: ok ? "PASS" : "FAIL", detail });

async function main() {
  const suffix = Date.now().toString(36);
  const permissions = await Promise.all([
    "identity.role.manage", "beneficiary.read", "donation.create", "donation.approve", "support.access.request", "support.access.approve",
  ].map((name) => prisma.permission.upsert({ where: { name }, update: {}, create: { name, module: name.split(".")[0], action: name.split(".")[1], description: `W02 audit ${name}` } })));
  const byName = new Map(permissions.map((permission) => [permission.name, permission]));
  const org = await prisma.organization.create({ data: { name: `W02 IAM ${suffix}` } });
  const admin = await prisma.user.create({ data: { name: `W02 Admin ${suffix}`, email: `w02-iam-admin-${suffix}@audit.invalid`, role: Role.MEMBER, activeOrganizationId: org.id } });
  const member = await prisma.user.create({ data: { name: `W02 Member ${suffix}`, email: `w02-iam-member-${suffix}@audit.invalid`, role: Role.MEMBER, activeOrganizationId: org.id } });
  const support = await prisma.user.create({ data: { name: `W02 Support ${suffix}`, email: `w02-iam-support-${suffix}@audit.invalid`, role: Role.MEMBER, activeOrganizationId: org.id } });
  const [adminMembership, memberMembership, supportMembership] = await Promise.all([
    prisma.organizationMembership.create({ data: { organizationId: org.id, userId: admin.id, role: Role.ADMIN, isDefault: true } }),
    prisma.organizationMembership.create({ data: { organizationId: org.id, userId: member.id, role: Role.MEMBER, isDefault: true } }),
    prisma.organizationMembership.create({ data: { organizationId: org.id, userId: support.id, role: Role.MEMBER, isDefault: true } }),
  ]);
  const adminRole = await prisma.organizationRole.create({ data: { organizationId: org.id, name: "ADMIN", isSystem: true } });
  const readerRole = await prisma.organizationRole.create({ data: { organizationId: org.id, name: "READER", isSystem: true } });
  const createRole = await prisma.organizationRole.create({ data: { organizationId: org.id, name: "DONATION_CREATOR", isSystem: true } });
  const approveRole = await prisma.organizationRole.create({ data: { organizationId: org.id, name: "DONATION_APPROVER", isSystem: true } });
  await prisma.organizationRolePermission.createMany({ data: [
    { organizationRoleId: adminRole.id, permissionId: byName.get("identity.role.manage")!.id },
    { organizationRoleId: adminRole.id, permissionId: byName.get("support.access.approve")!.id },
    { organizationRoleId: readerRole.id, permissionId: byName.get("beneficiary.read")!.id },
    { organizationRoleId: readerRole.id, permissionId: byName.get("support.access.request")!.id },
    { organizationRoleId: createRole.id, permissionId: byName.get("donation.create")!.id },
    { organizationRoleId: approveRole.id, permissionId: byName.get("donation.approve")!.id },
  ] });
  await prisma.membershipRole.create({ data: { membershipId: adminMembership.id, organizationRoleId: adminRole.id } });
  await prisma.organizationMembership.update({ where: { id: adminMembership.id }, data: { policyVersion: { increment: 1 } } });
  try {
    const adminContext = await resolveTenantContextForUser({ userId: admin.id, authVersion: 1 });
    await assignOrganizationRole({ context: adminContext, membershipId: memberMembership.id, organizationRoleId: readerRole.id });
    const memberContext = await resolveTenantContextForUser({ userId: member.id, authVersion: 1 });
    record("ROLE_ALLOW", (await evaluatePermission(memberContext, "beneficiary.read")).allowed, "Reader role allows beneficiary.read.");
    record("DEFAULT_DENY", !(await evaluatePermission(memberContext, "donation.approve")).allowed, "Unassigned permission denied.");
    await setMembershipPermissionOverride({ context: adminContext, membershipId: memberMembership.id, permissionName: "beneficiary.read", effect: PermissionEffect.DENY, reason: "audit deny" });
    const refreshedMemberContext = await resolveTenantContextForUser({ userId: member.id, authVersion: 1 });
    const denied = await evaluatePermission(refreshedMemberContext, "beneficiary.read");
    record("DENY_OVER_ALLOW", !denied.allowed && denied.reason === "EXPLICIT_DENY", `Decision ${denied.reason}.`);
    await assignOrganizationRole({ context: adminContext, membershipId: memberMembership.id, organizationRoleId: createRole.id });
    try {
      await assignOrganizationRole({ context: adminContext, membershipId: memberMembership.id, organizationRoleId: approveRole.id });
      record("SOD_DENY", false, "Conflicting role assignment succeeded.");
    } catch (error) {
      record("SOD_DENY", error instanceof Error && error.message.includes("SoD"), error instanceof Error ? error.message : String(error));
    }
    const supportContext = await resolveTenantContextForUser({ userId: support.id, authVersion: 1 });
    record("SUPPORT_DEFAULT_DENY", !(await evaluatePermission(supportContext, "support.access.approve")).allowed, "Support user has no implicit approval.");
    const noRestrictedAccess = await hasApprovedSupportReadAccess({ organizationId: org.id, requesterId: support.id, classification: "RESTRICTED" });
    record("SUPPORT_RESTRICTED_DENY", !noRestrictedAccess, "Restricted data remains denied by boundary.");
  } finally {
    await prisma.auditLog.deleteMany({ where: { organizationId: org.id } });
    await prisma.membershipPermissionOverride.deleteMany({ where: { membershipId: { in: [adminMembership.id, memberMembership.id, supportMembership.id] } } });
    await prisma.membershipRole.deleteMany({ where: { membershipId: { in: [adminMembership.id, memberMembership.id, supportMembership.id] } } });
    await prisma.organizationRolePermission.deleteMany({ where: { organizationRoleId: { in: [adminRole.id, readerRole.id, createRole.id, approveRole.id] } } });
    await prisma.organizationRole.deleteMany({ where: { id: { in: [adminRole.id, readerRole.id, createRole.id, approveRole.id] } } });
    await prisma.organizationMembership.deleteMany({ where: { id: { in: [adminMembership.id, memberMembership.id, supportMembership.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, member.id, support.id] } } });
    await prisma.organization.delete({ where: { id: org.id } });
  }
  const status = checks.every((check) => check.status === "PASS") ? "PASS" : "FAIL";
  console.log(JSON.stringify({ runId: `W02-WP2-${new Date().toISOString()}`, status, checks }));
  await prisma.$disconnect();
  process.exit(status === "PASS" ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
