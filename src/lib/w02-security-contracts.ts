import { createHash, randomBytes, timingSafeEqual, verify as verifySignature } from "node:crypto";
import { z } from "zod";

export class W02SecurityContractError extends Error {
  constructor(public readonly code: "SECRET_UNAVAILABLE" | "SECRET_REVOKED" | "POLICY_REQUIRED" | "LEGAL_HOLD" | "ACTIVATION_DENIED" | "IDP_DISABLED" | "IDP_CALLBACK_DENIED") {
    super(code);
    this.name = "W02SecurityContractError";
  }
}

export type OpaqueSecretReference = string & { readonly __opaqueSecretReference: unique symbol };
export type SecretResolver = Readonly<{ resolve(input: { reference: OpaqueSecretReference; purpose: string; correlationId: string }): Promise<Uint8Array> }>;

/** Test-only adapter. It has no environment lookup, persistence, logs, or provider semantics. */
export class MemoryOnlySecretResolver implements SecretResolver {
  private readonly values = new Map<string, Uint8Array>();
  register(reference: OpaqueSecretReference, value: Uint8Array) { this.values.set(reference, value.slice()); }
  revoke(reference: OpaqueSecretReference) { this.values.delete(reference); }
  async resolve(input: { reference: OpaqueSecretReference; purpose: string; correlationId: string }) {
    if (!input.purpose || !input.correlationId) throw new W02SecurityContractError("SECRET_UNAVAILABLE");
    const value = this.values.get(input.reference);
    if (!value) throw new W02SecurityContractError("SECRET_UNAVAILABLE");
    return value.slice();
  }
}

export function opaqueSecretReference(value: string): OpaqueSecretReference {
  if (!/^secretref:[a-zA-Z0-9._:-]{12,256}$/.test(value)) throw new W02SecurityContractError("SECRET_UNAVAILABLE");
  return value as OpaqueSecretReference;
}

export const privacyRequestInputSchema = z.object({
  type: z.enum(["ACCESS", "EXPORT", "DELETE", "CORRECT"]),
  recordType: z.string().trim().min(1).max(120),
  classification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]),
  purposeCode: z.string().trim().min(3).max(80),
});

export type PrivacyDecision = Readonly<{ allowed: boolean; code: "ALLOWED" | "POLICY_REQUIRED" | "LEGAL_HOLD" }>;
export function decidePrivacyAction(input: { policyApproved: boolean; legalHold: boolean }): PrivacyDecision {
  if (input.legalHold) return { allowed: false, code: "LEGAL_HOLD" };
  if (!input.policyApproved) return { allowed: false, code: "POLICY_REQUIRED" };
  return { allowed: true, code: "ALLOWED" };
}

export const certificateSchema = z.object({
  schemaVersion: z.literal(1),
  licenseKeyId: z.string().min(1),
  organizationId: z.string().min(1),
  instanceId: z.string().min(1),
  edition: z.enum(["SAAS", "DEDICATED", "SELF_HOSTED"]),
  issuedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  signature: z.object({ keyId: z.string().min(1), algorithm: z.literal("ed25519"), value: z.string().min(1) }),
});
export type SignedLicenseCertificate = z.infer<typeof certificateSchema>;
export type CertificateKeyring = Record<string, string>;

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
}

export function certificateSigningPayload(certificate: SignedLicenseCertificate): Buffer {
  const { signature: _signature, ...payload } = certificate;
  return Buffer.from(stableJson(payload));
}

export function verifyLicenseCertificate(input: unknown, keyring: CertificateKeyring, now = new Date()): SignedLicenseCertificate {
  const certificate = certificateSchema.parse(input);
  const publicKey = keyring[certificate.signature.keyId];
  if (!publicKey || new Date(certificate.expiresAt).getTime() <= now.getTime()) throw new W02SecurityContractError("ACTIVATION_DENIED");
  if (!verifySignature(null, certificateSigningPayload(certificate), publicKey, Buffer.from(certificate.signature.value, "base64"))) throw new W02SecurityContractError("ACTIVATION_DENIED");
  return certificate;
}

export function activationCodeMaterial(code: string, salt = randomBytes(16).toString("base64url")) {
  if (!/^[A-Za-z0-9_-]{12,128}$/.test(code)) throw new W02SecurityContractError("ACTIVATION_DENIED");
  return { salt, hash: createHash("sha256").update(`${salt}:${code}`).digest("base64url") };
}

export function matchesActivationCode(input: { code: string; salt: string; expectedHash: string }) {
  const actual = activationCodeMaterial(input.code, input.salt).hash;
  const expected = Buffer.from(input.expectedHash);
  const received = Buffer.from(actual);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function hashExternalSubject(subject: string) {
  if (!subject || subject.length > 1024) throw new W02SecurityContractError("IDP_CALLBACK_DENIED");
  return createHash("sha256").update(`w02-idp-subject:${subject}`).digest("base64url");
}

export function hashCallbackState(state: string) {
  if (!/^[A-Za-z0-9_-]{24,256}$/.test(state)) throw new W02SecurityContractError("IDP_CALLBACK_DENIED");
  return createHash("sha256").update(`w02-idp-state:${state}`).digest("base64url");
}

export function assertIdpCallback(input: { configStatus: "ACTIVE" | "DISABLED" | "REVOKED"; stateConsumedAt: Date | null; stateExpiresAt: Date; now?: Date }) {
  if (input.configStatus !== "ACTIVE") throw new W02SecurityContractError("IDP_DISABLED");
  if (input.stateConsumedAt || input.stateExpiresAt.getTime() <= (input.now ?? new Date()).getTime()) throw new W02SecurityContractError("IDP_CALLBACK_DENIED");
}
