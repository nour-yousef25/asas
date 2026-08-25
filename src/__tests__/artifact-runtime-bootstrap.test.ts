import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("artifact runtime bootstrap", () => {
  it("lazily installs the tenant runtime for production repository calls without adding a static import cycle", () => {
    const source = readFileSync(resolve(__dirname, "../lib/private-artifact.ts"), "utf8");
    expect(source).toContain('await import("@/lib/tenant-runtime-bootstrap")');
    expect(source).toContain("await this.ensureRuntime();");
  });
});
