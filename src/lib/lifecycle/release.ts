/**
 * W01 UPDATE-001/002 — سلامة الإصدار وخطة تحديث آمنة.
 * لا تنفذ هذه الطبقة ترقية مباشرة ولا تدّعي rollback لقاعدة البيانات.
 */
import { verify as verifySignature } from "node:crypto";
import { z } from "zod";
import { verifyBackupManifest, type BackupManifest } from "@/lib/lifecycle/backup";
import type { DeploymentEdition } from "@/lib/platform/contracts";

const sha256 = z.string().regex(/^sha256:[a-f0-9]{64}$/i);

export const releaseManifestSchema = z.object({
  schemaVersion: z.literal(1),
  release: z.object({
    version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
    channel: z.enum(["DEVELOPMENT", "BETA", "STABLE"]),
    issuedAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }).optional(),
  }),
  compatibility: z.object({
    editions: z.array(z.enum(["SAAS", "DEDICATED", "SELF_HOSTED"])).min(1),
    minNodeMajor: z.number().int().min(20),
    requiredModules: z.array(z.string()).default([]),
    migrationPolicy: z.literal("EXPAND_CONTRACT_ONLY"),
  }),
  artifact: z.object({
    uri: z.string().min(1),
    checksum: sha256,
  }),
  signature: z.object({
    keyId: z.string().min(1),
    algorithm: z.literal("ed25519"),
    value: z.string().min(1),
  }),
});

export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;
export type ReleaseKeyring = Record<string, string>;

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(",")}}`;
}

export function getManifestSigningPayload(manifest: ReleaseManifest): Buffer {
  const { signature: _signature, ...payload } = manifest;
  return Buffer.from(stableJson(payload));
}

export function parseReleaseKeyring(serialized: string | undefined): ReleaseKeyring {
  if (!serialized) return {};
  const parsed: unknown = JSON.parse(serialized);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("ASAS_RELEASE_PUBLIC_KEYS_JSON يجب أن يكون كائن مفاتيح عامة مرقمة.");
  }
  const keyring = Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  if (!Object.keys(keyring).length) throw new Error("لا توجد مفاتيح عامة صالحة للتحقق من الإصدارات.");
  return keyring;
}

export function verifyReleaseManifest(input: unknown, keyring: ReleaseKeyring, now = new Date()): ReleaseManifest {
  const manifest = releaseManifestSchema.parse(input);
  const publicKey = keyring[manifest.signature.keyId];
  if (!publicKey) throw new Error("معرف مفتاح توقيع الإصدار غير موثوق.");
  if (manifest.release.expiresAt && new Date(manifest.release.expiresAt).getTime() < now.getTime()) {
    throw new Error("Manifest الإصدار منتهي الصلاحية.");
  }

  const valid = verifySignature(null, getManifestSigningPayload(manifest), publicKey, Buffer.from(manifest.signature.value, "base64"));
  if (!valid) throw new Error("توقيع Manifest الإصدار غير صالح.");
  return manifest;
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split("-")[0].split(".").map(Number);
  const rightParts = right.split("-")[0].split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] > rightParts[index] ? 1 : -1;
  }
  return 0;
}

export type UpdatePlan = {
  status: "READY" | "BLOCKED";
  releaseVersion: string;
  reasons: string[];
  steps: string[];
  rollbackNotice: string;
};

export function createUpdatePlan(input: {
  manifest: ReleaseManifest;
  currentVersion: string;
  edition: DeploymentEdition;
  enabledModules?: string[];
  backupManifest: unknown;
}): UpdatePlan {
  const reasons: string[] = [];
  if (!input.manifest.compatibility.editions.includes(input.edition)) reasons.push("الإصدار غير متوافق مع edition الحالية.");
  if (compareVersions(input.manifest.release.version, input.currentVersion) <= 0) reasons.push("الإصدار ليس أحدث من النسخة الحالية.");
  const modules = new Set(input.enabledModules ?? []);
  const missingModules = input.manifest.compatibility.requiredModules.filter((module) => !modules.has(module));
  if (missingModules.length) reasons.push(`وحدات مطلوبة غير متاحة: ${missingModules.join(", ")}.`);

  try {
    const backup = verifyBackupManifest(input.backupManifest);
    if (backup.edition !== input.edition) reasons.push("نسخة الاحتياط لا تطابق edition الحالية.");
  } catch (error) {
    reasons.push(error instanceof Error ? error.message : "لا يمكن التحقق من النسخة الاحتياطية.");
  }

  return {
    status: reasons.length ? "BLOCKED" : "READY",
    releaseVersion: input.manifest.release.version,
    reasons,
    steps: [
      "Verify signed manifest and compatibility.",
      "Verify a complete, encrypted backup evidence before migration.",
      "Validate the release artifact checksum before application update.",
      "Run expansion-first database migration with captured evidence.",
      "Run health verification and retain an immutable update log.",
    ],
    rollbackNotice:
      "لا يضمن النظام rollback شاملاً لقاعدة البيانات؛ يعتمد الاسترداد على توافق التطبيق أو استعادة مدروسة من نسخة احتياطية متحققة.",
  };
}

export function assertUpdatePlanReady(plan: UpdatePlan): asserts plan is UpdatePlan & { status: "READY" } {
  if (plan.status !== "READY") throw new Error(`التحديث محجوب: ${plan.reasons.join(" ")}`);
}

export function getVerifiedBackupForUpdate(input: unknown): BackupManifest {
  return verifyBackupManifest(input);
}
