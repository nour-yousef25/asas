import { IdentityProviderRuntimeAdapter, MemoryIdpStateStore } from "@/lib/idp-runtime-adapter";

const config = { id: "idp_123456789012", organizationId: "org_123456789012", protocol: "OIDC" as const, status: "ACTIVE" as const, issuer: "https://login.identity.test", subjectClaim: "sub" };
const metadata = { issuer: "https://login.identity.test", authorization_endpoint: "https://login.identity.test/authorize", token_endpoint: "https://login.identity.test/token", jwks_uri: "https://login.identity.test/jwks", response_types_supported: ["code"] };

describe("IdP runtime adapter", () => {
  it("binds OIDC state, nonce and an exact allow-listed redirect without provider calls", async () => {
    const adapter = new IdentityProviderRuntimeAdapter(new MemoryIdpStateStore(), ["https://app.asasplus.shop/api/auth/idp/callback"], () => new Date("2026-08-25T12:00:00.000Z"));
    const begin = await adapter.beginOidc(config, metadata, "https://app.asasplus.shop/api/auth/idp/callback");
    expect(begin.authorizationUrl).toContain("response_type=code");
    await expect(adapter.consumeCallback({ configuration: config, state: begin.state, nonce: begin.nonce, subject: "external-subject" })).resolves.toMatchObject({ subjectHash: expect.any(String) });
    await expect(adapter.consumeCallback({ configuration: config, state: begin.state, nonce: begin.nonce, subject: "external-subject" })).rejects.toMatchObject({ code: "STATE_DENIED" });
  });

  it("rejects open redirects, issuer mismatch, and revoked configurations", async () => {
    const adapter = new IdentityProviderRuntimeAdapter(new MemoryIdpStateStore(), ["https://app.asasplus.shop/api/auth/idp/callback"]);
    await expect(adapter.beginOidc(config, metadata, "https://attacker.invalid/callback")).rejects.toMatchObject({ code: "REDIRECT_DENIED" });
    await expect(adapter.beginOidc(config, { ...metadata, issuer: "https://other.invalid" }, "https://app.asasplus.shop/api/auth/idp/callback")).rejects.toMatchObject({ code: "METADATA_DENIED" });
    await expect(adapter.beginOidc({ ...config, status: "REVOKED" }, metadata, "https://app.asasplus.shop/api/auth/idp/callback")).rejects.toMatchObject({ code: "UNCONFIGURED" });
  });

  it("accepts claims/assertions only after an external verifier reports a valid signature and contract bindings match", () => {
    const adapter = new IdentityProviderRuntimeAdapter(new MemoryIdpStateStore(), ["https://app.asasplus.shop/api/auth/idp/callback"], () => new Date("2026-08-25T12:00:00.000Z"));
    expect(adapter.validateOidcClaims({ signatureVerified: true, issuer: config.issuer, audience: "asas-plus", subject: "subject-1", nonce: "nonce-1", expiresAt: "2026-08-25T12:10:00.000Z" }, config, "asas-plus", "nonce-1")).toMatchObject({ subjectHash: expect.any(String) });
    expect(adapter.validateSamlAssertion({ signatureVerified: true, issuer: config.issuer, audience: "asas-plus", recipient: "https://app.asasplus.shop/api/auth/idp/callback", subject: "subject-1", expiresAt: "2026-08-25T12:10:00.000Z" }, { ...config, protocol: "SAML" }, "asas-plus")).toMatchObject({ redirectUri: "https://app.asasplus.shop/api/auth/idp/callback" });
    expect(() => adapter.validateOidcClaims({ signatureVerified: false, issuer: config.issuer, audience: "asas-plus", subject: "subject-1", nonce: "nonce-1", expiresAt: "2026-08-25T12:10:00.000Z" }, config, "asas-plus", "nonce-1")).toThrow("IDP_SUBJECT_DENIED");
  });
});
