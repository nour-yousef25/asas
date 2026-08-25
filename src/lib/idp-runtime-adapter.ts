import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { assertIdpCallback, hashCallbackState, hashExternalSubject, type OpaqueSecretReference } from "@/lib/w02-security-contracts";

export class IdentityProviderAdapterError extends Error {
  constructor(public readonly code: "UNCONFIGURED" | "METADATA_DENIED" | "REDIRECT_DENIED" | "STATE_DENIED" | "NONCE_DENIED" | "SUBJECT_DENIED" | "REVOKED") {
    super(`IDP_${code}`);
  }
}

const httpsUrl = z.string().url().refine((value) => new URL(value).protocol === "https:", "HTTPS is required");
export const oidcMetadataSchema = z.object({ issuer: httpsUrl, authorization_endpoint: httpsUrl, token_endpoint: httpsUrl, jwks_uri: httpsUrl, response_types_supported: z.array(z.string()).min(1) });
export const samlMetadataSchema = z.object({ entityId: httpsUrl, ssoUrl: httpsUrl, certificateReference: z.string().min(1) });
const verifiedOidcClaimsSchema = z.object({ signatureVerified: z.literal(true), issuer: httpsUrl, audience: z.string().min(1), subject: z.string().min(1).max(1024), nonce: z.string().min(1).max(512), expiresAt: z.coerce.date() });
const verifiedSamlAssertionSchema = z.object({ signatureVerified: z.literal(true), issuer: httpsUrl, audience: z.string().min(1), recipient: httpsUrl, subject: z.string().min(1).max(1024), expiresAt: z.coerce.date() });
export type IdentityProviderProtocol = "OIDC" | "SAML";
export type ProviderConfiguration = Readonly<{ id: string; organizationId: string; protocol: IdentityProviderProtocol; status: "ACTIVE" | "DISABLED" | "REVOKED"; issuer: string; subjectClaim: string; clientSecretReference?: OpaqueSecretReference }>;
export type IdpAuthorizationState = Readonly<{ configurationId: string; state: string; stateHash: string; nonceHash: string; redirectUri: string; expiresAt: Date; consumedAt: Date | null }>;
export type IdpStateStore = Readonly<{ issue(input: IdpAuthorizationState): Promise<void>; consume(stateHash: string): Promise<IdpAuthorizationState | undefined> }>;

function nonceHash(value: string) { return createHash("sha256").update(`idp-nonce:${value}`).digest("base64url"); }
function assertRedirectUri(value: string, allowed: readonly string[]) {
  if (!allowed.includes(value)) throw new IdentityProviderAdapterError("REDIRECT_DENIED");
  return value;
}

export class IdentityProviderRuntimeAdapter {
  constructor(private readonly states: IdpStateStore, private readonly allowedRedirectUris: readonly string[], private readonly now: () => Date = () => new Date()) {}

  async beginOidc(configuration: ProviderConfiguration, metadataInput: unknown, redirectUri: string) {
    if (configuration.protocol !== "OIDC" || configuration.status !== "ACTIVE") throw new IdentityProviderAdapterError("UNCONFIGURED");
    const metadata = oidcMetadataSchema.safeParse(metadataInput);
    if (!metadata.success || metadata.data.issuer !== configuration.issuer || !metadata.data.response_types_supported.includes("code")) throw new IdentityProviderAdapterError("METADATA_DENIED");
    const state = randomBytes(32).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    const callback = assertRedirectUri(redirectUri, this.allowedRedirectUris);
    const stateRecord: IdpAuthorizationState = { configurationId: configuration.id, state, stateHash: hashCallbackState(state), nonceHash: nonceHash(nonce), redirectUri: callback, expiresAt: new Date(this.now().getTime() + 5 * 60_000), consumedAt: null };
    await this.states.issue(stateRecord);
    const url = new URL(metadata.data.authorization_endpoint);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", configuration.id);
    url.searchParams.set("redirect_uri", callback);
    url.searchParams.set("scope", "openid");
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    return { authorizationUrl: url.toString(), state, nonce };
  }

  async consumeCallback(input: Readonly<{ configuration: ProviderConfiguration; state: string; nonce: string; subject: string }>) {
    const state = await this.states.consume(hashCallbackState(input.state));
    if (!state || state.configurationId !== input.configuration.id) throw new IdentityProviderAdapterError("STATE_DENIED");
    try { assertIdpCallback({ configStatus: input.configuration.status, stateConsumedAt: state.consumedAt, stateExpiresAt: state.expiresAt, now: this.now() }); } catch { throw new IdentityProviderAdapterError(input.configuration.status === "REVOKED" ? "REVOKED" : "STATE_DENIED"); }
    if (nonceHash(input.nonce) !== state.nonceHash) throw new IdentityProviderAdapterError("NONCE_DENIED");
    try { return { subjectHash: hashExternalSubject(input.subject), redirectUri: state.redirectUri }; } catch { throw new IdentityProviderAdapterError("SUBJECT_DENIED"); }
  }

  validateOidcClaims(input: unknown, configuration: ProviderConfiguration, expectedAudience: string, expectedNonce: string) {
    const claims = verifiedOidcClaimsSchema.safeParse(input);
    if (!claims.success || claims.data.issuer !== configuration.issuer || claims.data.audience !== expectedAudience || claims.data.nonce !== expectedNonce || claims.data.expiresAt.getTime() <= this.now().getTime()) throw new IdentityProviderAdapterError("SUBJECT_DENIED");
    try { return { subjectHash: hashExternalSubject(claims.data.subject) }; } catch { throw new IdentityProviderAdapterError("SUBJECT_DENIED"); }
  }

  validateSamlConfiguration(configuration: ProviderConfiguration, metadataInput: unknown) {
    if (configuration.protocol !== "SAML" || configuration.status !== "ACTIVE") throw new IdentityProviderAdapterError("UNCONFIGURED");
    const metadata = samlMetadataSchema.safeParse(metadataInput);
    if (!metadata.success || metadata.data.entityId !== configuration.issuer) throw new IdentityProviderAdapterError("METADATA_DENIED");
    return metadata.data;
  }

  validateSamlAssertion(input: unknown, configuration: ProviderConfiguration, expectedAudience: string) {
    const assertion = verifiedSamlAssertionSchema.safeParse(input);
    if (!assertion.success || assertion.data.issuer !== configuration.issuer || assertion.data.audience !== expectedAudience || !this.allowedRedirectUris.includes(assertion.data.recipient) || assertion.data.expiresAt.getTime() <= this.now().getTime()) throw new IdentityProviderAdapterError("SUBJECT_DENIED");
    try { return { subjectHash: hashExternalSubject(assertion.data.subject), redirectUri: assertion.data.recipient }; } catch { throw new IdentityProviderAdapterError("SUBJECT_DENIED"); }
  }
}

export class MemoryIdpStateStore implements IdpStateStore {
  private readonly values = new Map<string, IdpAuthorizationState>();
  async issue(input: IdpAuthorizationState) { this.values.set(input.stateHash, input); }
  async consume(stateHash: string) {
    const value = this.values.get(stateHash);
    if (!value || value.consumedAt) return value;
    const consumed = { ...value, consumedAt: new Date() };
    this.values.set(stateHash, consumed);
    return value;
  }
}
