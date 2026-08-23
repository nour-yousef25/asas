import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("dashboard tenant-bound cutover guard", () => {
  it("forbids global Prisma and raw identity paths in DashboardRepository", () => {
    const source = read("src/lib/dashboard-repository.ts");
    expect(source).toContain("requireTenantBoundPrismaExecutor");
    expect(source).not.toMatch(/@\/lib\/db|current_setting|set_config|DATABASE_URL/);
    expect(source).toContain("organizationId");
  });

  it("requires server tenant context, semantic dashboard permission and repository use in the dashboard page", () => {
    const source = read("src/app/(dashboard)/page.tsx");
    expect(source).toContain("requireTenantContext");
    expect(source).toContain('requirePermission(context, "dashboard.read")');
    expect(source).toContain("dashboardRepository.getSnapshot(context)");
    expect(source).not.toMatch(/@\/lib\/db|prisma\./);
  });
});
