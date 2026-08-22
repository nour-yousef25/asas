import { collectHealthReport } from "@/lib/health/health-service";
import { verifyBackupManifest } from "@/lib/lifecycle/backup";

const baseEnvironment = {
  NODE_ENV: "test",
  ASAS_EDITION: "SAAS",
  ASAS_INSTANCE_ROLE: "APP",
  ASAS_RELEASE_VERSION: "1.2.3",
  ASAS_RELEASE_CHANNEL: "STABLE",
  DATABASE_URL: "postgresql://user:password@localhost:5432/asas",
};

describe("W01 health foundation", () => {
  it("reports UNAVAILABLE when the required database probe fails", async () => {
    const report = await collectHealthReport(
      {
        database: async () => {
          throw new Error("connection refused");
        },
        redis: async () => undefined,
        disk: async () => ({ available: 90, total: 100 }),
        memory: () => ({ available: 90, total: 100 }),
        cpuCount: () => 2,
      },
      baseEnvironment,
    );

    expect(report.status).toBe("UNAVAILABLE");
    expect(report.checks.find((check) => check.name === "database")).toMatchObject({ status: "UNAVAILABLE" });
    expect(report.checks.find((check) => check.name === "redis")).toMatchObject({ status: "NOT_CONFIGURED" });
  });

  it("reports configured optional Redis as degraded when the probe fails", async () => {
    const report = await collectHealthReport(
      {
        database: async () => undefined,
        redis: async () => {
          throw new Error("redis unavailable");
        },
        disk: async () => ({ available: 90, total: 100 }),
        memory: () => ({ available: 90, total: 100 }),
        cpuCount: () => 2,
      },
      { ...baseEnvironment, REDIS_URL: "redis://localhost:6379" },
    );

    expect(report.status).toBe("DEGRADED");
    expect(report.checks.find((check) => check.name === "redis")).toMatchObject({ status: "DEGRADED" });
    expect(report.checks.find((check) => check.name === "queue")).toMatchObject({ status: "DEGRADED" });
  });
});

describe("W01 backup foundation", () => {
  const validManifest = {
    schemaVersion: 1,
    backupId: "123e4567-e89b-12d3-a456-426614174000",
    createdAt: "2026-08-22T00:00:00.000Z",
    verifiedAt: "2026-08-22T00:01:00.000Z",
    edition: "SAAS",
    owner: "ASAS",
    location: "s3://asas-backups/backup.tar.gz",
    checksum: `sha256:${"a".repeat(64)}`,
    encryption: { enabled: true, owner: "ASAS" },
    contents: { database: true, storage: true, configuration: true },
  };

  it("accepts a verified, complete backup manifest", () => {
    expect(verifyBackupManifest(validManifest, new Date("2026-08-22T00:02:00.000Z"))).toMatchObject({
      backupId: validManifest.backupId,
      verifiedAt: validManifest.verifiedAt,
    });
  });

  it("rejects an unverified manifest instead of reporting a false successful backup", () => {
    const { verifiedAt: _verifiedAt, ...unverifiedManifest } = validManifest;
    expect(() => verifyBackupManifest(unverifiedManifest)).toThrow("لا يمكن اعتبار النسخة الاحتياطية صالحة للتحديث قبل التحقق منها");
  });
});
