import { validateControlPlaneMetadata } from "@/lib/platform/control-plane";

describe("W01 deployment control-plane boundary", () => {
  const metadata = {
    installationId: "123e4567-e89b-12d3-a456-426614174000",
    edition: "DEDICATED",
    releaseVersion: "1.0.0",
    releaseChannel: "STABLE",
    supportContractRef: "SUP-123",
    observedAt: "2026-08-22T00:00:00.000Z",
  };

  it("accepts minimal lifecycle metadata only", () => {
    expect(validateControlPlaneMetadata(metadata)).toEqual(metadata);
  });

  it("rejects operational or beneficiary fields at the Control Plane boundary", () => {
    expect(() => validateControlPlaneMetadata({ ...metadata, beneficiaryName: "بيانات محظورة" })).toThrow();
    expect(() => validateControlPlaneMetadata({ ...metadata, databaseUrl: "postgresql://secret" })).toThrow();
  });
});
