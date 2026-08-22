/**
 * W01 BACKUP-001 — عقد سياسة النسخ الاحتياطي والتحقق من evidences.
 * لا ينفذ هذا العقد نسخة وهمية؛ أي تحديث لاحق يحتاج manifest صالحاً ومتحققاً.
 */
import { z } from "zod";
import type { DeploymentEdition } from "@/lib/platform/contracts";

export const BACKUP_OWNERS = ["ASAS", "CUSTOMER", "SHARED"] as const;
export type BackupOwner = (typeof BACKUP_OWNERS)[number];

export const backupManifestSchema = z.object({
  schemaVersion: z.literal(1),
  backupId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  verifiedAt: z.string().datetime({ offset: true }).optional(),
  edition: z.enum(["SAAS", "DEDICATED", "SELF_HOSTED"]),
  owner: z.enum(BACKUP_OWNERS),
  location: z.string().min(1),
  checksum: z.string().regex(/^sha256:[a-f0-9]{64}$/i),
  encryption: z.object({ enabled: z.boolean(), owner: z.enum(BACKUP_OWNERS) }),
  contents: z.object({ database: z.literal(true), storage: z.boolean(), configuration: z.literal(true) }),
});

export type BackupManifest = z.infer<typeof backupManifestSchema>;

export type BackupPolicy = {
  owner: BackupOwner;
  retentionDays: number;
  encryptionRequired: boolean;
  requiresPreUpdateVerification: true;
  responsibility: string;
};

function defaultBackupOwner(edition: DeploymentEdition): BackupOwner {
  if (edition === "SAAS") return "ASAS";
  if (edition === "DEDICATED") return "SHARED";
  return "CUSTOMER";
}

export function getBackupPolicy(
  edition: DeploymentEdition,
  environment: Record<string, string | undefined> = process.env,
): BackupPolicy {
  const parsedRetention = Number(environment.ASAS_BACKUP_RETENTION_DAYS ?? "30");
  const owner = environment.ASAS_BACKUP_OWNER as BackupOwner | undefined;

  if (owner && !BACKUP_OWNERS.includes(owner)) {
    throw new Error("ASAS_BACKUP_OWNER يجب أن يكون ASAS أو CUSTOMER أو SHARED.");
  }
  if (!Number.isInteger(parsedRetention) || parsedRetention < 1 || parsedRetention > 3650) {
    throw new Error("ASAS_BACKUP_RETENTION_DAYS يجب أن يكون عدداً صحيحاً بين 1 و3650.");
  }

  const resolvedOwner = owner ?? defaultBackupOwner(edition);
  return {
    owner: resolvedOwner,
    retentionDays: parsedRetention,
    encryptionRequired: environment.NODE_ENV === "production",
    requiresPreUpdateVerification: true,
    responsibility:
      resolvedOwner === "ASAS"
        ? "ASAS يدير النسخ والتحقق وفق عقد الخدمة."
        : resolvedOwner === "CUSTOMER"
          ? "العميل مسؤول عن البنية والنسخ والتحقق، وASAS يوفر عقود التحقق وrunbooks."
          : "المسؤولية مشتركة وفق مصفوفة الدعم والعقد التشغيلي.",
  };
}

export function verifyBackupManifest(input: unknown, now = new Date()): BackupManifest {
  const manifest = backupManifestSchema.parse(input);
  if (!manifest.verifiedAt) {
    throw new Error("لا يمكن اعتبار النسخة الاحتياطية صالحة للتحديث قبل التحقق منها.");
  }
  if (new Date(manifest.verifiedAt).getTime() > now.getTime()) {
    throw new Error("وقت تحقق النسخة الاحتياطية غير صالح.");
  }
  if (manifest.encryption.enabled === false && process.env.NODE_ENV === "production") {
    throw new Error("النسخ الاحتياطية الإنتاجية يجب أن تكون مشفرة.");
  }
  return manifest;
}
