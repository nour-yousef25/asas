import { generateKeyPairSync, sign } from "node:crypto";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { certificateSigningPayload, type SignedLicenseCertificate } from "@/lib/w02-security-contracts";
import { assertRuntimeLicense, loadRuntimeLicense, RuntimeLicenseError } from "@/lib/runtime-license";

describe("runtime license enforcement", () => {
  let directory = "";
  beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), "asas-license-")); });
  afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

  async function fixture(revoked = false) {
    const keys = generateKeyPairSync("ed25519");
    const unsigned = { schemaVersion: 1 as const, licenseKeyId: "license-fixture", organizationId: "org_123456789012", instanceId: "instance-fixture", edition: "SAAS" as const, issuedAt: "2026-08-24T00:00:00.000Z", expiresAt: "2026-08-26T00:00:00.000Z", signature: { keyId: "production-2026", algorithm: "ed25519" as const, value: "" } };
    const certificate: SignedLicenseCertificate = { ...unsigned, signature: { ...unsigned.signature, value: sign(null, certificateSigningPayload(unsigned), keys.privateKey).toString("base64") } };
    const certificatePath = join(directory, "certificate.json");
    const keyringPath = join(directory, "keyring.json");
    const revocationPath = join(directory, "revocation.json");
    await Promise.all([
      writeFile(certificatePath, JSON.stringify(certificate), { mode: 0o600 }),
      writeFile(keyringPath, JSON.stringify({ "production-2026": keys.publicKey.export({ type: "spki", format: "pem" }).toString() }), { mode: 0o600 }),
      writeFile(revocationPath, JSON.stringify({ revokedLicenseKeyIds: revoked ? ["license-fixture"] : [] }), { mode: 0o600 }),
    ]);
    await Promise.all([chmod(certificatePath, 0o600), chmod(keyringPath, 0o600), chmod(revocationPath, 0o600)]);
    return { NODE_ENV: "test", ASAS_EDITION: "SAAS", ASAS_LICENSE_REQUIRED: "true", ASAS_LICENSE_CERTIFICATE_PATH: certificatePath, ASAS_LICENSE_KEYRING_PATH: keyringPath, ASAS_LICENSE_REVOCATION_PATH: revocationPath, ASAS_INSTANCE_ID: "instance-fixture" };
  }

  it("loads a signed, bound, non-revoked certificate without any private signing key", async () => {
    const environment = await fixture();
    await expect(loadRuntimeLicense(environment, new Date("2026-08-25T12:00:00.000Z"))).resolves.toMatchObject({ certificate: { licenseKeyId: "license-fixture" }, keyId: "production-2026" });
    await expect(assertRuntimeLicense({ ...environment, ASAS_LICENSE_REQUIRED: "false" })).resolves.toBeUndefined();
  });

  it("fails closed for a revocation instead of accepting a valid signature", async () => {
    const environment = await fixture(true);
    await expect(loadRuntimeLicense(environment, new Date("2026-08-25T12:00:00.000Z"))).rejects.toMatchObject({ code: "REVOKED" } satisfies Partial<RuntimeLicenseError>);
  });
});
