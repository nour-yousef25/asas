import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { activationCodeMaterial, assertIdpCallback, certificateSigningPayload, hashCallbackState, hashExternalSubject, MemoryOnlySecretResolver, opaqueSecretReference, verifyLicenseCertificate, W02SecurityContractError } from "@/lib/w02-security-contracts";

describe("W02 internal security contracts", () => {
  it("W02I01 resolves opaque memory-only secret material once without environment fallback", async () => {
    const resolver = new MemoryOnlySecretResolver();
    const reference = opaqueSecretReference("secretref:fixture-reference-0001");
    resolver.register(reference, Buffer.from("in-memory-material"));
    await expect(resolver.resolve({ reference, purpose: "idp.callback", correlationId: "corr-w02i01" })).resolves.toEqual(Buffer.from("in-memory-material"));
    resolver.revoke(reference);
    await expect(resolver.resolve({ reference, purpose: "idp.callback", correlationId: "corr-w02i01" })).rejects.toMatchObject({ code: "SECRET_UNAVAILABLE" });
  });

  it("W02I02 rejects missing purpose or malformed opaque secret reference", () => {
    expect(() => opaqueSecretReference("not-a-reference")).toThrow(W02SecurityContractError);
  });

  it("W02I03 verifies a locally generated public-key certificate and rejects expiry or tampering", () => {
    const keys = generateKeyPairSync("ed25519");
    const base = { schemaVersion: 1 as const, licenseKeyId: "lic-fixture", organizationId: "org-a", instanceId: "instance-a", edition: "SAAS" as const, issuedAt: "2026-08-24T00:00:00.000Z", expiresAt: "2026-08-25T00:00:00.000Z" };
    const unsigned = { ...base, signature: { keyId: "fixture-key", algorithm: "ed25519" as const, value: "" } };
    const certificate = { ...unsigned, signature: { ...unsigned.signature, value: sign(null, certificateSigningPayload(unsigned), keys.privateKey).toString("base64") } };
    expect(verifyLicenseCertificate(certificate, { "fixture-key": keys.publicKey.export({ type: "spki", format: "pem" }).toString() }, new Date("2026-08-24T12:00:00.000Z")).licenseKeyId).toBe("lic-fixture");
    expect(() => verifyLicenseCertificate({ ...certificate, instanceId: "instance-b" }, { "fixture-key": keys.publicKey.export({ type: "spki", format: "pem" }).toString() }, new Date("2026-08-24T12:00:00.000Z"))).toThrow(W02SecurityContractError);
    expect(() => verifyLicenseCertificate(certificate, { "fixture-key": keys.publicKey.export({ type: "spki", format: "pem" }).toString() }, new Date("2026-08-26T00:00:00.000Z"))).toThrow(W02SecurityContractError);
  });

  it("W02I04 hashes activation and IdP state values without returning source material", () => {
    const material = activationCodeMaterial("ActivationFixture_123");
    expect(material.hash).not.toContain("ActivationFixture_123");
    expect(hashExternalSubject("subject-a")).not.toContain("subject-a");
    expect(hashCallbackState("abcdefghijklmnopqrstuvwxyz_012345")).not.toContain("abcdefghijklmnopqrstuvwxyz");
  });

  it("W02I05 fails closed for disabled, replayed, or expired IdP callback state", () => {
    expect(() => assertIdpCallback({ configStatus: "DISABLED", stateConsumedAt: null, stateExpiresAt: new Date("2026-08-25T00:00:00.000Z"), now: new Date("2026-08-24T00:00:00.000Z") })).toThrow(W02SecurityContractError);
    expect(() => assertIdpCallback({ configStatus: "ACTIVE", stateConsumedAt: new Date(), stateExpiresAt: new Date("2026-08-25T00:00:00.000Z"), now: new Date("2026-08-24T00:00:00.000Z") })).toThrow(W02SecurityContractError);
    expect(() => assertIdpCallback({ configStatus: "ACTIVE", stateConsumedAt: null, stateExpiresAt: new Date("2026-08-23T00:00:00.000Z"), now: new Date("2026-08-24T00:00:00.000Z") })).toThrow(W02SecurityContractError);
  });

  it("W02I06 keeps the new repository tenant-bound and forbids global-db, raw-GUC and fallback patterns", () => {
    const source = readFileSync("src/lib/w02-security-repository.ts", "utf8");
    expect(source).toMatch(/TenantBoundPrismaExecutor/);
    expect(source).not.toMatch(/from "@\/lib\/db"|new PrismaClient|current_setting|set_config|DATABASE_URL|organizationMemberships\[0\]|activeOrganizationId/);
  });
});
