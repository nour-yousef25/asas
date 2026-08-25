import { BootstrapAdminProvisioner, MemoryBootstrapAdminAuditStore } from "@/lib/bootstrap-admin-provisioner";

const request = { requestId: "bootstrap_request_123456789", organizationId: "org_123456789012", email: "owner@charity.sa", displayName: "Production Owner", reason: "Initial accountable administrator is required.", requestedAt: "2026-08-25T12:00:00.000Z", expiresAt: "2026-08-26T12:00:00.000Z", mode: "AUDIT_FIXTURE" as const };

describe("bootstrap-admin provisioner", () => {
  it("permits only an audited fixture harness, is idempotent, and never creates a production user", async () => {
    const store = new MemoryBootstrapAdminAuditStore();
    const provisioner = new BootstrapAdminProvisioner(store, true, () => new Date("2026-08-25T13:00:00.000Z"));
    await expect(provisioner.execute(request, "corr-bootstrap-1")).resolves.toMatchObject({ outcome: "FIXTURE_PROVISIONED", actorFingerprint: expect.any(String) });
    await expect(provisioner.execute(request, "corr-bootstrap-2")).rejects.toMatchObject({ code: "DUPLICATE_REQUEST" });
    await expect(provisioner.execute({ ...request, requestId: "bootstrap_request_123456790", mode: "PRODUCTION" })).rejects.toMatchObject({ code: "PRODUCTION_DISABLED" });
    expect(store.events).toHaveLength(1);
    expect(JSON.stringify(store.events)).not.toContain("owner@charity.sa");
  });

  it("records revocation and blocks re-use of the revoked request", async () => {
    const store = new MemoryBootstrapAdminAuditStore();
    const provisioner = new BootstrapAdminProvisioner(store, false, () => new Date("2026-08-25T13:00:00.000Z"));
    await provisioner.execute({ ...request, mode: "DRY_RUN" });
    await expect(provisioner.revoke(request.requestId, request.organizationId)).resolves.toMatchObject({ action: "REVOKED" });
    await expect(provisioner.execute({ ...request, mode: "DRY_RUN" })).rejects.toMatchObject({ code: "REQUEST_REVOKED" });
  });
});
