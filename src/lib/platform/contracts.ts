/**
 * W01 Foundation — عقود التشغيل المشتركة.
 * تحافظ هذه الوحدة على نواة واحدة قابلة للتكوين لـSaaS وDedicated وSelf-Hosted.
 */

export const DEPLOYMENT_EDITIONS = ["SAAS", "DEDICATED", "SELF_HOSTED"] as const;
export type DeploymentEdition = (typeof DEPLOYMENT_EDITIONS)[number];

export const INSTANCE_ROLES = ["APP", "WORKER", "ALL"] as const;
export type InstanceRole = (typeof INSTANCE_ROLES)[number];

export const RELEASE_CHANNELS = ["DEVELOPMENT", "BETA", "STABLE"] as const;
export type ReleaseChannel = (typeof RELEASE_CHANNELS)[number];

export const COMPONENT_STATUSES = [
  "HEALTHY",
  "DEGRADED",
  "UNAVAILABLE",
  "NOT_CONFIGURED",
] as const;
export type ComponentStatus = (typeof COMPONENT_STATUSES)[number];

export type ComponentCheck = {
  name: string;
  status: ComponentStatus;
  required: boolean;
  latencyMs?: number;
  summary: string;
};

export type OverallHealthStatus = Exclude<ComponentStatus, "NOT_CONFIGURED">;

export function deriveOverallHealth(checks: ComponentCheck[]): OverallHealthStatus {
  if (checks.some((check) => check.required && check.status === "UNAVAILABLE")) {
    return "UNAVAILABLE";
  }

  if (
    checks.some(
      (check) =>
        check.status === "DEGRADED" ||
        (!check.required && check.status === "UNAVAILABLE"),
    )
  ) {
    return "DEGRADED";
  }

  return "HEALTHY";
}

export function healthHttpStatus(status: OverallHealthStatus): number {
  return status === "UNAVAILABLE" ? 503 : 200;
}
