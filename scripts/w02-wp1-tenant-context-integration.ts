import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  assertTenantResource,
  bumpMembershipPolicyVersion,
  invalidateUserSessions,
  resolveTenantContextForUser,
  switchActiveOrganization,
  TenantAuthorizationError,
} from "@/lib/tenant-context";

type Evidence = { runId: string; status: "PASS" | "FAIL"; checks: Array<{ name: string; status: "PASS" | "FAIL"; detail: string }> };
const runId = `W02-WP1-${new Date().toISOString()}`;
const evidence: Evidence = { runId, status: "PASS", checks: [] };
const record = (name: string, status: "PASS" | "FAIL", detail: string) => {
  evidence.checks.push({ name, status, detail });
  if (status === "FAIL") evidence.status = "FAIL";
};

async function expectTenantError(name: string, action: () => Promise<unknown>, code: TenantAuthorizationError["code"]) {
  try {
    await action();
    record(name, "FAIL", `Expected ${code}, but action succeeded.`);
  } catch (error) {
    const actual = error instanceof TenantAuthorizationError ? error.code : "UNKNOWN";
    record(name, actual === code ? "PASS" : "FAIL", `Expected ${code}; received ${actual}.`);
  }
}

async function main() {
  const suffix = Date.now().toString(36);
  const user = await prisma.user.create({ data: { name: `W02 WP1 ${suffix}`, email: `w02-wp1-${suffix}@audit.invalid`, role: Role.MEMBER } });
  const noMembership = await prisma.user.create({ data: { name: `W02 No Membership ${suffix}`, email: `w02-wp1-none-${suffix}@audit.invalid`, role: Role.MEMBER } });
  const orgA = await prisma.organization.create({ data: { name: `W02 Org A ${suffix}` } });
  const orgB = await prisma.organization.create({ data: { name: `W02 Org B ${suffix}` } });
  const orgC = await prisma.organization.create({ data: { name: `W02 Org C ${suffix}` } });
  const membershipA = await prisma.organizationMembership.create({ data: { organizationId: orgA.id, userId: user.id, role: Role.MEMBER, isDefault: true } });
  await prisma.organizationMembership.create({ data: { organizationId: orgB.id, userId: user.id, role: Role.EDITOR } });
  await prisma.user.update({ where: { id: user.id }, data: { activeOrganizationId: orgA.id } });

  try {
    const a = await resolveTenantContextForUser({ userId: user.id, authVersion: 1, correlationId: runId });
    record("ORG_A_ALLOW", a.organizationId === orgA.id && a.membershipId === membershipA.id && a.policySnapshotVersion === 1 ? "PASS" : "FAIL", `Resolved ${a.organizationId}.`);
    expectTenantError("ORG_A_TO_B_DENY", async () => assertTenantResource(a, orgB.id), "FORBIDDEN_TENANT_RESOURCE");
    await expectTenantError("TENANT_SPOOFING_DENY", () => switchActiveOrganization({ userId: user.id, authVersion: 1, organizationId: orgC.id }), "NO_ACTIVE_MEMBERSHIP");
    const b = await switchActiveOrganization({ userId: user.id, authVersion: 1, organizationId: orgB.id, correlationId: runId });
    record("SAFE_ORGANIZATION_SWITCH", b.organizationId === orgB.id ? "PASS" : "FAIL", `Resolved ${b.organizationId}.`);
    const switchAudit = await prisma.auditLog.count({ where: { userId: user.id, action: "TENANT_CONTEXT_SWITCHED", organizationId: orgB.id } });
    record("TENANT_SWITCH_AUDIT", switchAudit === 1 ? "PASS" : "FAIL", `Audit events: ${switchAudit}.`);
    const bumped = await bumpMembershipPolicyVersion(b.membershipId);
    record("POLICY_VERSION_BUMP", bumped.policyVersion === 2 ? "PASS" : "FAIL", `Policy version: ${bumped.policyVersion}.`);
    await expectTenantError("NO_MEMBERSHIP_DENY", () => resolveTenantContextForUser({ userId: noMembership.id, authVersion: 1 }), "NO_ACTIVE_MEMBERSHIP");
    await prisma.organizationMembership.update({ where: { id: membershipA.id }, data: { isActive: false, revokedAt: new Date() } });
    await prisma.user.update({ where: { id: user.id }, data: { activeOrganizationId: orgA.id } });
    await expectTenantError("INACTIVE_MEMBERSHIP_DENY", () => resolveTenantContextForUser({ userId: user.id, authVersion: 1 }), "NO_ACTIVE_MEMBERSHIP");
    await invalidateUserSessions(user.id);
    await expectTenantError("STALE_SESSION_DENY", () => resolveTenantContextForUser({ userId: user.id, authVersion: 1 }), "STALE_SESSION");
  } finally {
    await prisma.auditLog.deleteMany({ where: { userId: user.id } });
    await prisma.organizationMembership.deleteMany({ where: { userId: { in: [user.id, noMembership.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [user.id, noMembership.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id, orgC.id] } } });
  }

  console.log(JSON.stringify(evidence));
  await prisma.$disconnect();
  process.exit(evidence.status === "PASS" ? 0 : 1);
}

main().catch(async (error) => {
  record("UNHANDLED", "FAIL", error instanceof Error ? error.message : String(error));
  console.log(JSON.stringify(evidence));
  await prisma.$disconnect();
  process.exit(1);
});
