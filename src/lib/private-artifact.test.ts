import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("W02 private artifact cutover guard", () => {
  it("requires tenant-bound metadata, immutable server keying, and an injected provider", () => {
    const artifact = source("src/lib/private-artifact.ts");
    expect(artifact).toContain("requireTenantBoundPrismaExecutor");
    expect(artifact).toContain("requireTenantArtifactProvider");
    expect(artifact).toContain("private/${organizationId}/artifact/${artifactId}/v${version}");
    expect(artifact).toContain("organizationId: context.organizationId");
    expect(artifact).not.toMatch(/getPublicUrl|S3_SECRET_KEY|S3_ACCESS_KEY|process\.env\.S3/);
  });

  it("quarantines raw storage and legacy upload rather than accepting caller paths", () => {
    const legacyStorage = source("src/lib/storage.ts");
    const legacyUpload = source("src/app/api/upload/route.ts");
    expect(legacyStorage).toContain("LEGACY_STORAGE_SURFACE_QUARANTINED");
    expect(legacyStorage).not.toMatch(/minioadmin|S3_ENDPOINT|STORAGE_PATHS/);
    expect(legacyUpload).toContain("LEGACY_UPLOAD_SURFACE_QUARANTINED");
    expect(legacyUpload).not.toContain("formData");
  });

  it("keeps the new documents API on server-side tenant context", () => {
    const documents = source("src/app/api/documents/route.ts");
    const document = source("src/app/api/documents/[id]/route.ts");
    expect(documents).toContain("requireTenantContext");
    expect(document).toContain("requireTenantContext");
    expect(documents).not.toMatch(/organizationId.*form|getPublicUrl/);
  });
});
