import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertTenantPolicySnapshot, assertTenantResource, bumpMembershipPolicyVersion, invalidateUserSessions, resolveTenantContextForUser, switchActiveOrganization, TenantAuthorizationError } from "@/lib/tenant-context";

type Check = { name: string; status: "PASS" | "FAIL"; detail: string };
const checks: Check[] = [];
const add = (name: string, ok: boolean, detail: string) => checks.push({ name, status: ok ? "PASS" : "FAIL", detail });
async function denied(name: string, work: () => Promise<unknown>, code: TenantAuthorizationError["code"]) {
  try { await work(); add(name, false, `Expected ${code}, action succeeded.`); }
  catch (error) { const actual = error instanceof TenantAuthorizationError ? error.code : "UNKNOWN"; add(name, actual === code, `Expected=${code};actual=${actual}`); }
}

async function main() {
  const suffix = Date.now().toString(36);
  const orgA = await prisma.organization.create({ data: { name: `WP5-1 Org A ${suffix}` } });
  const orgB = await prisma.organization.create({ data: { name: `WP5-1 Org B ${suffix}` } });
  const orgC = await prisma.organization.create({ data: { name: `WP5-1 Org C ${suffix}` } });
  const userA = await prisma.user.create({ data: { name: `WP5-1 User A ${suffix}`, email: `wp5-1-a-${suffix}@audit.invalid`, role: Role.MEMBER, activeOrganizationId: orgA.id } });
  const userB = await prisma.user.create({ data: { name: `WP5-1 User B ${suffix}`, email: `wp5-1-b-${suffix}@audit.invalid`, role: Role.MEMBER, activeOrganizationId: orgB.id } });
  const noMembership = await prisma.user.create({ data: { name: `WP5-1 None ${suffix}`, email: `wp5-1-none-${suffix}@audit.invalid`, role: Role.MEMBER } });
  const disabled = await prisma.user.create({ data: { name: `WP5-1 Disabled ${suffix}`, email: `wp5-1-disabled-${suffix}@audit.invalid`, role: Role.MEMBER, activeOrganizationId: orgA.id } });
  const revoked = await prisma.user.create({ data: { name: `WP5-1 Revoked ${suffix}`, email: `wp5-1-revoked-${suffix}@audit.invalid`, role: Role.MEMBER, activeOrganizationId: orgB.id } });
  const membershipA = await prisma.organizationMembership.create({ data: { organizationId: orgA.id, userId: userA.id, role: Role.MEMBER, isDefault: true } });
  await prisma.organizationMembership.create({ data: { organizationId: orgB.id, userId: userB.id, role: Role.MEMBER, isDefault: true } });
  await prisma.organizationMembership.create({ data: { organizationId: orgB.id, userId: userA.id, role: Role.EDITOR } });
  await prisma.organizationMembership.create({ data: { organizationId: orgA.id, userId: disabled.id, role: Role.MEMBER, isActive: false } });
  await prisma.organizationMembership.create({ data: { organizationId: orgB.id, userId: revoked.id, role: Role.MEMBER, revokedAt: new Date() } });
  try {
    const a = await resolveTenantContextForUser({ userId: userA.id, authVersion: 1, correlationId: `wp5-1-${suffix}` });
    const b = await resolveTenantContextForUser({ userId: userB.id, authVersion: 1 });
    add("TWO_ORG_VALID_CONTEXT", a.organizationId === orgA.id && b.organizationId === orgB.id && a.membershipId === membershipA.id, `A=${a.organizationId};B=${b.organizationId}`);
    await denied("NO_MEMBERSHIP_DENY", () => resolveTenantContextForUser({ userId: noMembership.id, authVersion: 1 }), "NO_ACTIVE_MEMBERSHIP");
    await denied("DISABLED_MEMBERSHIP_DENY", () => resolveTenantContextForUser({ userId: disabled.id, authVersion: 1 }), "NO_ACTIVE_MEMBERSHIP");
    await denied("REVOKED_MEMBERSHIP_DENY", () => resolveTenantContextForUser({ userId: revoked.id, authVersion: 1 }), "NO_ACTIVE_MEMBERSHIP");
    await denied("CLIENT_ORGANIZATION_SPOOF_DENY", async () => { const spoof = await resolveTenantContextForUser({ userId: userA.id, authVersion: 1, organizationId: orgB.id } as never); assertTenantResource(spoof, orgB.id); }, "FORBIDDEN_TENANT_RESOURCE");
    await denied("UNAUTHORIZED_SWITCH_DENY", () => switchActiveOrganization({ userId: userA.id, authVersion: 1, organizationId: orgC.id, correlationId: a.correlationId }), "NO_ACTIVE_MEMBERSHIP");
    const deniedAudit = await prisma.auditLog.count({ where: { userId: userA.id, action: "TENANT_CONTEXT_SWITCH_DENIED", organizationId: orgA.id } });
    add("UNAUTHORIZED_SWITCH_AUDIT", deniedAudit === 1, `audit=${deniedAudit}`);
    const switched = await switchActiveOrganization({ userId: userA.id, authVersion: 1, organizationId: orgB.id, correlationId: a.correlationId });
    const successAudit = await prisma.auditLog.count({ where: { userId: userA.id, action: "TENANT_CONTEXT_SWITCHED", organizationId: orgB.id } });
    add("AUTHORIZED_SWITCH_AND_AUDIT", switched.organizationId === orgB.id && successAudit === 1, `org=${switched.organizationId};audit=${successAudit}`);
    await bumpMembershipPolicyVersion(membershipA.id);
    await denied("STALE_POLICY_DENY", () => assertTenantPolicySnapshot(a), "STALE_POLICY");
    await invalidateUserSessions(userA.id);
    await denied("STALE_SESSION_DENY", () => resolveTenantContextForUser({ userId: userA.id, authVersion: 1 }), "STALE_SESSION");
  } finally {
    await prisma.auditLog.deleteMany({ where: { userId: { in: [userA.id, userB.id, noMembership.id, disabled.id, revoked.id] } } });
    await prisma.organizationMembership.deleteMany({ where: { userId: { in: [userA.id, userB.id, noMembership.id, disabled.id, revoked.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id, noMembership.id, disabled.id, revoked.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id, orgC.id] } } });
  }
  const status = checks.every((check) => check.status === "PASS") ? "PASS" : "FAIL";
  console.log(JSON.stringify({ runId: `W02-WP5-1-${new Date().toISOString()}`, status, checks }));
  await prisma.$disconnect(); process.exit(status === "PASS" ? 0 : 1);
}
main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
