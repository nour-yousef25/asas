import {
  deriveOverallHealth,
  healthHttpStatus,
  type ComponentCheck,
} from "@/lib/platform/contracts";
import {
  getRuntimeConfigurationIssues,
  getRuntimeConfigurationSummary,
} from "@/lib/platform/runtime-config";
import { redactForLog } from "@/lib/observability/redaction";

const healthyChecks: ComponentCheck[] = [
  { name: "application", status: "HEALTHY", required: true, summary: "Available" },
  { name: "database", status: "HEALTHY", required: true, summary: "Connected" },
];

describe("W01 platform contracts", () => {
  it("returns UNAVAILABLE and HTTP 503 when a required component is unavailable", () => {
    const status = deriveOverallHealth([
      ...healthyChecks,
      { name: "database", status: "UNAVAILABLE", required: true, summary: "Connection refused" },
    ]);

    expect(status).toBe("UNAVAILABLE");
    expect(healthHttpStatus(status)).toBe(503);
  });

  it("returns DEGRADED when an optional configured dependency is unavailable", () => {
    const status = deriveOverallHealth([
      ...healthyChecks,
      { name: "redis", status: "UNAVAILABLE", required: false, summary: "Connection refused" },
    ]);

    expect(status).toBe("DEGRADED");
    expect(healthHttpStatus(status)).toBe(200);
  });

  it("creates a safe runtime configuration summary without secrets", () => {
    const summary = getRuntimeConfigurationSummary({
      NODE_ENV: "production",
      ASAS_EDITION: "DEDICATED",
      ASAS_INSTANCE_ROLE: "ALL",
      ASAS_RELEASE_VERSION: "1.0.0",
      ASAS_RELEASE_CHANNEL: "STABLE",
      DATABASE_URL: "postgresql://user:password@localhost:5432/asas",
      REDIS_URL: "redis://localhost:6379",
      S3_ENDPOINT: "https://storage.example.test",
      S3_ACCESS_KEY: "access-key",
      S3_SECRET_KEY: "secret-key",
      S3_BUCKET: "asas",
    });

    expect(summary).toEqual({
      environment: "production",
      edition: "DEDICATED",
      instanceRole: "ALL",
      release: { version: "1.0.0", channel: "STABLE" },
      dependencies: { database: true, redis: true, storage: true, publicUrl: false },
    });
    expect(JSON.stringify(summary)).not.toContain("secret-key");
  });

  it("reports malformed runtime configuration instead of silently accepting it", () => {
    expect(
      getRuntimeConfigurationIssues({
        NODE_ENV: "production",
        DATABASE_URL: "mysql://unsupported",
      }),
    ).toContainEqual(expect.stringContaining("DATABASE_URL"));
  });

  it("redacts credentials, access tokens, cookies and bearer values recursively", () => {
    expect(
      redactForLog({
        password: "secret",
        nested: { accessToken: "abc", safe: "visible" },
        authorization: "Bearer token-value",
        values: [{ cookie: "session=value" }],
      }),
    ).toEqual({
      password: "[REDACTED]",
      nested: { accessToken: "[REDACTED]", safe: "visible" },
      authorization: "[REDACTED]",
      values: [{ cookie: "[REDACTED]" }],
    });
  });
});
