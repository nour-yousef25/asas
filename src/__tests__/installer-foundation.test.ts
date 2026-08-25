import { createHmac } from "node:crypto";
import { isInstallerAccessAuthorized, isRecoveryUnlockAuthorized } from "@/lib/installer/authorization";
import { collectPreflightReport } from "@/lib/installer/preflight";

const environment = {
  NODE_ENV: "test",
  ASAS_EDITION: "SELF_HOSTED",
  ASAS_INSTANCE_ROLE: "APP",
  ASAS_RELEASE_VERSION: "1.0.0",
  ASAS_RELEASE_CHANNEL: "STABLE",
  DATABASE_URL: "postgresql://user:password@localhost:5432/asas",
  REDIS_URL: "redis://localhost:6379",
};

describe("W01 installer foundation", () => {
  const originalAccessToken = process.env.ASAS_INSTALLER_ACCESS_TOKEN;
  const originalRecoverySecret = process.env.ASAS_INSTALLER_RECOVERY_SECRET;

  beforeEach(() => {
    process.env.ASAS_INSTALLER_ACCESS_TOKEN = "installer-access-token";
    process.env.ASAS_INSTALLER_RECOVERY_SECRET = "recovery-secret";
  });

  afterAll(() => {
    process.env.ASAS_INSTALLER_ACCESS_TOKEN = originalAccessToken;
    process.env.ASAS_INSTALLER_RECOVERY_SECRET = originalRecoverySecret;
  });

  it("requires the server-side installer access token", () => {
    expect(isInstallerAccessAuthorized("installer-access-token")).toBe(true);
    expect(isInstallerAccessAuthorized("incorrect-token")).toBe(false);
    expect(isInstallerAccessAuthorized(null)).toBe(false);
  });

  it("accepts only a fresh signed recovery unlock request", () => {
    const now = Date.parse("2026-08-22T05:00:00.000Z");
    const timestamp = String(now);
    const signature = createHmac("sha256", "recovery-secret").update(`asas-installer-recovery:${timestamp}`).digest("hex");

    expect(isRecoveryUnlockAuthorized(timestamp, signature, now)).toBe(true);
    expect(isRecoveryUnlockAuthorized(String(now - 6 * 60 * 1000), signature, now)).toBe(false);
    expect(isRecoveryUnlockAuthorized(timestamp, "invalid", now)).toBe(false);
  });

  it("marks preflight not ready when the required database probe fails", async () => {
    const report = await collectPreflightReport(environment, {
      database: async () => {
        throw new Error("database unavailable");
      },
      redis: async () => undefined,
      disk: async () => ({ available: 90, total: 100 }),
      memory: () => ({ available: 90, total: 100 }),
      cpuCount: () => 2,
      permissions: async () => undefined,
    });

    expect(report.ready).toBe(false);
    expect(report.checks.find((check) => check.name === "database")).toMatchObject({ status: "UNAVAILABLE" });
  });

  it("marks preflight ready when required services and resources pass", async () => {
    const report = await collectPreflightReport(environment, {
      database: async () => undefined,
      redis: async () => undefined,
      disk: async () => ({ available: 90, total: 100 }),
      memory: () => ({ available: 90, total: 100 }),
      cpuCount: () => 2,
      permissions: async () => undefined,
    });

    expect(report.ready).toBe(true);
    expect(report.checks.find((check) => check.name === "node")).toMatchObject({ status: "HEALTHY" });
  });

  it("uses configured read-only storage and egress probes without treating configuration alone as healthy", async () => {
    const report = await collectPreflightReport(
      {
        ...environment,
        TENANT_STORAGE_REFERENCE_DIRECTORY: "/run/asas/storage-references",
        TENANT_STORAGE_CREDENTIAL_DIRECTORY: "/run/asas/storage-credentials",
        ASAS_PREFLIGHT_STORAGE_PROBE_URL: "https://storage.example.test/health",
        ASAS_PREFLIGHT_EGRESS_URL: "https://egress.example.test/health",
      },
      {
        database: async () => undefined,
        redis: async () => undefined,
        storage: async () => undefined,
        egress: async () => undefined,
        tls: async () => undefined,
        disk: async () => ({ available: 90, total: 100 }),
        memory: () => ({ available: 90, total: 100 }),
        cpuCount: () => 2,
        permissions: async () => undefined,
      },
    );

    expect(report.checks.find((check) => check.name === "storage")).toMatchObject({ status: "HEALTHY" });
    expect(report.checks.find((check) => check.name === "egress")).toMatchObject({ status: "HEALTHY" });
  });
});
