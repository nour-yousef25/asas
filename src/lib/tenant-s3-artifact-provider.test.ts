import { TenantS3ArtifactProvider, TenantStorageProviderError } from "@/lib/tenant-s3-artifact-provider";
import { opaqueSecretReference } from "@/lib/w02-security-contracts";

const organizationId = "org_123456789012";
const artifactId = "artifact_123456789012";
const objectKey = `private/${organizationId}/artifact/${artifactId}/v1`;
const references = { resolve: async () => opaqueSecretReference("secretref:tenant-storage-reference-a1") };
const credentials = { resolve: async () => ({ endpoint: "https://s3.example.test", region: "me-central-1", bucket: "tenant-private", accessKeyId: "AKIDEXAMPLE", secretAccessKey: "test-secret-not-a-real-provider-secret" }) };

describe("TenantS3ArtifactProvider", () => {
  it("signs a tenant-private PUT without exposing a raw object URL", async () => {
    const calls: Array<{ url: URL; init?: RequestInit }> = [];
    const provider = new TenantS3ArtifactProvider(references, credentials, async (input, init) => {
      calls.push({ url: new URL(String(input)), init });
      return { ok: true } as Response;
    }, () => new Date("2026-08-25T12:00:00.000Z"));

    await provider.put({ organizationId, artifactId, objectKey, data: new Uint8Array([1, 2, 3]), contentType: "application/pdf" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url.pathname).toBe(`/tenant-private/${objectKey}`);
    expect(calls[0].init?.headers).toMatchObject({ "x-amz-content-sha256": expect.any(String), authorization: expect.stringContaining("AWS4-HMAC-SHA256") });
    expect(String((calls[0].init?.headers as Record<string, string>).authorization)).not.toContain("test-secret-not-a-real-provider-secret");
  });

  it("denies cross-tenant keys before any provider request", async () => {
    const fetcher = jest.fn();
    const provider = new TenantS3ArtifactProvider(references, credentials, fetcher);
    await expect(provider.put({ organizationId, artifactId, objectKey: "private/org_other_123456789/artifact/artifact_123456789012/v1", data: new Uint8Array([1]), contentType: "text/plain" }))
      .rejects.toMatchObject({ code: "OBJECT_SCOPE_DENIED" } satisfies Partial<TenantStorageProviderError>);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("issues a short-lived signed delivery URL only for the same tenant artifact", async () => {
    const provider = new TenantS3ArtifactProvider(references, credentials, async () => { throw new Error("network must not be called when issuing delivery"); }, () => new Date("2026-08-25T12:00:00.000Z"));
    const delivery = await provider.issueDelivery({ organizationId, artifactId, objectKey, expiresInSeconds: 120 });
    expect(delivery.delivery).toContain("X-Amz-Signature=");
    expect(delivery.delivery).not.toContain("test-secret-not-a-real-provider-secret");
    expect(delivery.expiresAt.toISOString()).toBe("2026-08-25T12:02:00.000Z");
  });
});
