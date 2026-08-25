import { chmod, mkdtemp, mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalTenantArtifactProvider } from "@/lib/local-tenant-artifact-provider";

const organizationId = "org_123456789012";
const artifactId = "artifact_123456789012";
const objectKey = `private/${organizationId}/artifact/${artifactId}/v1`;

describe("LocalTenantArtifactProvider", () => {
  let root = "";
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "asas-local-artifact-")); await chmod(root, 0o750); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it("stores only tenant-private keys and returns no local path in short-lived delivery", async () => {
    const provider = new LocalTenantArtifactProvider(root, "a".repeat(32), "/api/documents/delivery", () => new Date("2026-08-25T12:00:00.000Z"));
    await provider.put({ organizationId, artifactId, objectKey, data: new Uint8Array([1, 2, 3]), contentType: "application/pdf" });
    const details = await stat(join(root, ...objectKey.split("/")));
    expect(details.mode & 0o007).toBe(0);
    const delivery = await provider.issueDelivery({ organizationId, artifactId, objectKey, expiresInSeconds: 120 });
    expect(delivery.delivery).toMatch(/^\/api\/documents\/delivery\?token=/);
    expect(delivery.delivery).not.toContain(root);
    await expect(provider.resolveDelivery(new URL(`https://localhost${delivery.delivery}`).searchParams.get("token")!, organizationId)).resolves.toMatchObject({ data: Buffer.from([1, 2, 3]) });
  });

  it("denies cross-tenant traversal and token replay into another tenant", async () => {
    const provider = new LocalTenantArtifactProvider(root, "b".repeat(32), "/api/documents/delivery", () => new Date("2026-08-25T12:00:00.000Z"));
    await expect(provider.put({ organizationId, artifactId, objectKey: "private/org_other_123456789/artifact/artifact_123456789012/v1", data: new Uint8Array([1]), contentType: "text/plain" })).rejects.toMatchObject({ code: "OBJECT_SCOPE_DENIED" });
    await provider.put({ organizationId, artifactId, objectKey, data: new Uint8Array([1]), contentType: "text/plain" });
    const delivery = await provider.issueDelivery({ organizationId, artifactId, objectKey, expiresInSeconds: 120 });
    await expect(provider.resolveDelivery(new URL(`https://localhost${delivery.delivery}`).searchParams.get("token")!, "org_other_123456789")).rejects.toMatchObject({ code: "DELIVERY_DENIED" });
  });
});
