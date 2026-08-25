import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("server instrumentation bootstrap", () => {
  it("does not skip Node standalone bootstrap solely because NEXT_RUNTIME is absent", () => {
    const source = readFileSync(resolve(__dirname, "../../instrumentation.ts"), "utf8");
    expect(source).toContain('if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return;');
    expect(source).toContain("bootstrapTenantRuntime();");
  });
});
