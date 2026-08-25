import { BootstrapControlPlaneProvisioner, type BootstrapControlAudit, type BootstrapControlPlaneStore } from "@/lib/bootstrap-control-plane";

const request = { requestId: "bootstrap_abcdefghijklmnop", kind: "SUPER_ADMIN" as const, administrator: { email: "admin@asasplus.shop", name: "Platform Owner" }, approvedBy: "Product Owner", approvalReference: "APR-2026-0001", passwordFile: "/root/bootstrap-password", requestedAt: "2026-08-25T12:00:00.000Z", expiresAt: "2026-08-26T12:00:00.000Z" };

describe("BootstrapControlPlaneProvisioner", () => {
  it("requires explicit execution and records a redacted idempotent audit event", async () => {
    const audits: BootstrapControlAudit[] = [];
    const store: BootstrapControlPlaneStore = { findRequest: async (id) => audits.find((audit) => audit.requestId === id), provision: async () => ({ userId: "user_123456789012", outcome: "PROVISIONED" }), append: async (audit) => { audits.push(audit); } };
    const provisioner = new BootstrapControlPlaneProvisioner(store, () => new Date("2026-08-25T13:00:00.000Z"));
    await expect(provisioner.execute(request, "a".repeat(16), false)).rejects.toMatchObject({ code: "EXECUTION_DISABLED" });
    await expect(provisioner.execute(request, "a".repeat(16), true)).resolves.toMatchObject({ outcome: "PROVISIONED" });
    expect(JSON.stringify(audits)).not.toContain("admin@asasplus.shop");
    await expect(provisioner.execute(request, "a".repeat(16), true)).resolves.toMatchObject({ outcome: "IDEMPOTENT" });
  });
});
