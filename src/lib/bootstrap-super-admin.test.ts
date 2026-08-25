import { BootstrapSuperAdminError, bootstrapSuperAdminRequestSchema, provisionBootstrapSuperAdmin } from "@/lib/bootstrap-super-admin";

const request = bootstrapSuperAdminRequestSchema.parse({ requestId: "bootstrap_super_admin_20260825_platform", kind: "PLATFORM_SUPER_ADMIN", email: "platform-admin@bootstrap.invalid", displayName: "ASAS Platform Administrator", approvedBy: "Platform Owner", approvalReference: "AUTH-GATE-55", passwordFile: "/root/password", requestedAt: "2026-08-25T00:00:00.000Z", expiresAt: "2026-09-01T00:00:00.000Z" });

describe("Bootstrap Super Admin", () => {
  const base = { countOrganizationMemberships: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({ id: "user_123", email: "platform-admin@bootstrap.invalid", role: "SUPER_ADMIN", isActive: true, activeOrganizationId: null }) };
  it("creates only a platform SUPER_ADMIN with no organization membership", async () => {
    const result = await provisionBootstrapSuperAdmin({ ...base, findByEmail: jest.fn().mockResolvedValue(null) }, request, Buffer.from("safe-password"), new Date("2026-08-26T00:00:00.000Z"));
    expect(result.outcome).toBe("PROVISIONED");
    expect(base.create).toHaveBeenCalledWith(expect.objectContaining({ role: "SUPER_ADMIN", activeOrganizationId: null }));
  });
  it("does not reset an existing valid account", async () => {
    const create = jest.fn();
    const result = await provisionBootstrapSuperAdmin({ ...base, create, findByEmail: jest.fn().mockResolvedValue({ id: "user_123", email: "platform-admin@bootstrap.invalid", role: "SUPER_ADMIN", isActive: true, activeOrganizationId: null }) }, request, undefined, new Date("2026-08-26T00:00:00.000Z"));
    expect(result.outcome).toBe("ALREADY_VALID");
    expect(create).not.toHaveBeenCalled();
  });
  it("rejects an existing account that has tenant authority", async () => {
    await expect(provisionBootstrapSuperAdmin({ ...base, findByEmail: jest.fn().mockResolvedValue({ id: "user_123", email: "platform-admin@bootstrap.invalid", role: "SUPER_ADMIN", isActive: true, activeOrganizationId: "org_123" }) }, request, undefined, new Date("2026-08-26T00:00:00.000Z"))).rejects.toMatchObject({ code: "EXISTING_USER_INVALID" } satisfies Partial<BootstrapSuperAdminError>);
  });
});
