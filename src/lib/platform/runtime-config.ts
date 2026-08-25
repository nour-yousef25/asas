/**
 * W01 Foundation — عقد تكوين خادمي مُصادق عليه ولا يعرض قيم الأسرار.
 */
import { z } from "zod";
import {
  DEPLOYMENT_EDITIONS,
  INSTANCE_ROLES,
  RELEASE_CHANNELS,
  type DeploymentEdition,
  type InstanceRole,
  type ReleaseChannel,
} from "@/lib/platform/contracts";

const databaseUrlSchema = z
  .string()
  .regex(/^postgres(?:ql)?:\/\//, "DATABASE_URL يجب أن يبدأ بـ postgresql:// أو postgres://")
  .optional();

const runtimeConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ASAS_EDITION: z.enum(DEPLOYMENT_EDITIONS).default("SAAS"),
  ASAS_INSTANCE_ROLE: z.enum(INSTANCE_ROLES).default("APP"),
  ASAS_RELEASE_VERSION: z.string().trim().min(1).default("0.1.0"),
  ASAS_RELEASE_CHANNEL: z.enum(RELEASE_CHANNELS).default("DEVELOPMENT"),
  ASAS_PUBLIC_URL: z.string().url().optional(),
  DATABASE_URL: databaseUrlSchema,
  REDIS_URL: z.string().url().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY: z.string().min(1).optional(),
  S3_SECRET_KEY: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  TENANT_STORAGE_REFERENCE_DIRECTORY: z.string().min(1).optional(),
  TENANT_STORAGE_CREDENTIAL_DIRECTORY: z.string().min(1).optional(),
  TENANT_STORAGE_ALLOWED_GROUP_ID: z.string().regex(/^(0|[1-9][0-9]{0,9})$/).optional(),
  ASAS_PREFLIGHT_STORAGE_PROBE_URL: z.string().url().optional(),
  ASAS_PREFLIGHT_EGRESS_URL: z.string().url().optional(),
  ASAS_BACKUP_MANIFEST_PATH: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  INTEGRATIONS_ENCRYPTION_KEY: z.string().min(1).optional(),
  ASAS_LICENSE_REQUIRED: z.enum(["true", "false"]).optional(),
  ASAS_LICENSE_CERTIFICATE_PATH: z.string().min(1).optional(),
  ASAS_LICENSE_KEYRING_PATH: z.string().min(1).optional(),
  ASAS_LICENSE_REVOCATION_PATH: z.string().min(1).optional(),
  ASAS_INSTANCE_ID: z.string().min(1).optional(),
  ASAS_SCHEDULER_HEARTBEAT_PATH: z.string().min(1).optional(),
  ASAS_SCHEDULER_MAX_LAG_SECONDS: z.string().regex(/^[1-9][0-9]{0,5}$/).optional(),
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

export type RuntimeConfigurationSummary = {
  environment: RuntimeConfig["NODE_ENV"];
  edition: DeploymentEdition;
  instanceRole: InstanceRole;
  release: { version: string; channel: ReleaseChannel };
  dependencies: {
    database: boolean;
    redis: boolean;
    storage: boolean;
    publicUrl: boolean;
  };
};

export function getRuntimeConfig(environment: Record<string, string | undefined> = process.env): RuntimeConfig {
  return runtimeConfigSchema.parse(environment);
}

export function getRuntimeConfigurationSummary(
  environment: Record<string, string | undefined> = process.env,
): RuntimeConfigurationSummary {
  const config = getRuntimeConfig(environment);
  return {
    environment: config.NODE_ENV,
    edition: config.ASAS_EDITION,
    instanceRole: config.ASAS_INSTANCE_ROLE,
    release: { version: config.ASAS_RELEASE_VERSION, channel: config.ASAS_RELEASE_CHANNEL },
    dependencies: {
      database: Boolean(config.DATABASE_URL),
      redis: Boolean(config.REDIS_URL),
      storage: Boolean(config.TENANT_STORAGE_REFERENCE_DIRECTORY && config.TENANT_STORAGE_CREDENTIAL_DIRECTORY),
      publicUrl: Boolean(config.ASAS_PUBLIC_URL),
    },
  };
}

export function getRuntimeConfigurationIssues(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  const result = runtimeConfigSchema.safeParse(environment);
  if (result.success) return [];
  return result.error.issues.map((issue) => `${issue.path.join(".") || "configuration"}: ${issue.message}`);
}
