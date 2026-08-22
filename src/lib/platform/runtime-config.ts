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
  AUTH_SECRET: z.string().min(32).optional(),
  INTEGRATIONS_ENCRYPTION_KEY: z.string().min(1).optional(),
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
      storage: Boolean(config.S3_ENDPOINT && config.S3_ACCESS_KEY && config.S3_SECRET_KEY && config.S3_BUCKET),
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
