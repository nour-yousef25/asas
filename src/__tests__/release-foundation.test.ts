import { generateKeyPairSync, sign } from "node:crypto";
import {
  createUpdatePlan,
  getManifestSigningPayload,
  verifyReleaseManifest,
  type ReleaseManifest,
} from "@/lib/lifecycle/release";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");

function signedManifest(): ReleaseManifest {
  const manifest: ReleaseManifest = {
    schemaVersion: 1,
    release: { version: "1.1.0", channel: "STABLE", issuedAt: "2026-08-22T00:00:00.000Z" },
    compatibility: { editions: ["SAAS", "DEDICATED"], minNodeMajor: 20, requiredModules: ["core"], migrationPolicy: "EXPAND_CONTRACT_ONLY" },
    artifact: { uri: "release://asas/1.1.0", checksum: `sha256:${"a".repeat(64)}` },
    signature: { keyId: "w01-test", algorithm: "ed25519", value: "" },
  };
  manifest.signature.value = sign(null, getManifestSigningPayload(manifest), privateKey).toString("base64");
  return manifest;
}

const verifiedBackup = {
  schemaVersion: 1,
  backupId: "123e4567-e89b-12d3-a456-426614174000",
  createdAt: "2026-08-22T00:00:00.000Z",
  verifiedAt: "2026-08-22T00:01:00.000Z",
  edition: "SAAS",
  owner: "ASAS",
  location: "fixture://backup",
  checksum: `sha256:${"a".repeat(64)}`,
  encryption: { enabled: true, owner: "ASAS" },
  contents: { database: true, storage: true, configuration: true },
};

describe("W01 release integrity foundation", () => {
  it("verifies a signed manifest using its numbered public key", () => {
    const manifest = signedManifest();
    expect(verifyReleaseManifest(manifest, { "w01-test": publicKey.export({ type: "spki", format: "pem" }).toString() })).toMatchObject({
      release: { version: "1.1.0" },
    });
  });

  it("rejects a manifest with a tampered artifact checksum", () => {
    const manifest = signedManifest();
    manifest.artifact.checksum = `sha256:${"b".repeat(64)}`;
    expect(() => verifyReleaseManifest(manifest, { "w01-test": publicKey.export({ type: "spki", format: "pem" }).toString() })).toThrow(
      "توقيع Manifest الإصدار غير صالح",
    );
  });

  it("blocks update planning when backup verification is absent", () => {
    const plan = createUpdatePlan({
      manifest: signedManifest(),
      currentVersion: "1.0.0",
      edition: "SAAS",
      enabledModules: ["core"],
      backupManifest: { ...verifiedBackup, verifiedAt: undefined },
    });
    expect(plan.status).toBe("BLOCKED");
    expect(plan.reasons.join(" ")).toContain("لا يمكن اعتبار النسخة الاحتياطية صالحة");
  });

  it("creates a ready plan only with a compatible verified backup", () => {
    const plan = createUpdatePlan({
      manifest: signedManifest(),
      currentVersion: "1.0.0",
      edition: "SAAS",
      enabledModules: ["core"],
      backupManifest: verifiedBackup,
    });
    expect(plan.status).toBe("READY");
    expect(plan.rollbackNotice).toContain("لا يضمن النظام rollback شاملاً");
  });
});
