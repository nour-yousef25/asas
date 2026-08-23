import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("Member/KPI tenant-bound cutover guard", () => {
  it("forbids global Prisma and identity fallbacks in the repository", () => {
    const source = read("src/lib/member-kpi-repository.ts");
    expect(source).toContain("requireTenantBoundPrismaExecutor");
    expect(source).not.toMatch(/@\/lib\/db|current_setting|set_config|DATABASE_URL/);
    expect(source).toContain("organizationId: context.organizationId");
  });

  it("requires TenantContext, semantic permissions and repository calls in converted APIs", () => {
    for (const file of ["src/app/api/members/route.ts", "src/app/api/kpi/route.ts"]) {
      const source = read(file);
      expect(source).toContain("requireTenantContext");
      expect(source).toContain("requirePermission");
      expect(source).toContain("memberKpiRepository");
      expect(source).not.toMatch(/@\/lib\/db|prisma\./);
    }
  });
});
