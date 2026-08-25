import { readFile, stat } from "node:fs/promises";
import { getRuntimeConfig } from "@/lib/platform/runtime-config";
import { verifyLicenseCertificate, type CertificateKeyring, type SignedLicenseCertificate, W02SecurityContractError } from "@/lib/w02-security-contracts";

export class RuntimeLicenseError extends Error {
  constructor(public readonly code: "UNCONFIGURED" | "FILE_DENIED" | "CERTIFICATE_DENIED" | "INSTANCE_DENIED" | "EDITION_DENIED" | "REVOKED") {
    super(`RUNTIME_LICENSE_${code}`);
  }
}

async function readRootOnlyJson(path: string) {
  const details = await stat(path).catch(() => undefined);
  if (!details || !details.isFile() || (details.mode & 0o077) !== 0) throw new RuntimeLicenseError("FILE_DENIED");
  try { return JSON.parse(await readFile(path, "utf8")) as unknown; } catch { throw new RuntimeLicenseError("CERTIFICATE_DENIED"); }
}

export type RuntimeLicenseResult = Readonly<{ certificate: SignedLicenseCertificate; keyId: string }>;

export async function loadRuntimeLicense(environment: Record<string, string | undefined> = process.env, now = new Date()): Promise<RuntimeLicenseResult> {
  const certificatePath = environment.ASAS_LICENSE_CERTIFICATE_PATH;
  const keyringPath = environment.ASAS_LICENSE_KEYRING_PATH;
  const instanceId = environment.ASAS_INSTANCE_ID;
  const revocationPath = environment.ASAS_LICENSE_REVOCATION_PATH;
  if (!certificatePath || !keyringPath || !instanceId || !revocationPath) throw new RuntimeLicenseError("UNCONFIGURED");
  const [certificateInput, keyringInput, revocationsInput] = await Promise.all([readRootOnlyJson(certificatePath), readRootOnlyJson(keyringPath), readRootOnlyJson(revocationPath)]);
  if (!keyringInput || typeof keyringInput !== "object" || Array.isArray(keyringInput)) throw new RuntimeLicenseError("CERTIFICATE_DENIED");
  const revocations = revocationsInput && typeof revocationsInput === "object" && Array.isArray((revocationsInput as { revokedLicenseKeyIds?: unknown }).revokedLicenseKeyIds)
    ? (revocationsInput as { revokedLicenseKeyIds: unknown[] }).revokedLicenseKeyIds.filter((value): value is string => typeof value === "string")
    : undefined;
  if (!revocations) throw new RuntimeLicenseError("CERTIFICATE_DENIED");
  let certificate: SignedLicenseCertificate;
  try { certificate = verifyLicenseCertificate(certificateInput, keyringInput as CertificateKeyring, now); } catch (error) {
    if (error instanceof W02SecurityContractError) throw new RuntimeLicenseError("CERTIFICATE_DENIED");
    throw error;
  }
  const config = getRuntimeConfig(environment);
  if (certificate.instanceId !== instanceId) throw new RuntimeLicenseError("INSTANCE_DENIED");
  if (certificate.edition !== config.ASAS_EDITION) throw new RuntimeLicenseError("EDITION_DENIED");
  if (revocations.includes(certificate.licenseKeyId)) throw new RuntimeLicenseError("REVOKED");
  return { certificate, keyId: certificate.signature.keyId };
}

export async function assertRuntimeLicense(environment: Record<string, string | undefined> = process.env) {
  if (environment.ASAS_LICENSE_REQUIRED !== "true") return undefined;
  return loadRuntimeLicense(environment);
}
