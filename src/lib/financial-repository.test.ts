import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Financial tenant cutover structural guards", () => {
  it("requires TenantBoundPrismaExecutor and has no global Prisma import", () => {
    const repository = source("src/lib/financial-repository.ts");
    expect(repository).not.toMatch(/from \"@\/lib\/db\"/);
    expect(repository).toMatch(/requireTenantBoundPrismaExecutor/);
    expect(repository).toMatch(/TenantBoundPrismaExecutor/);
  });

  it("uses server tenant context and semantic permission guards on financial dashboard pages", () => {
    const donors = source("src/app/(dashboard)/donors/page.tsx");
    const donations = source("src/app/(dashboard)/donations/page.tsx");
    expect(donors).toMatch(/requireTenantContext/);
    expect(donors).toMatch(/requirePermission\(context, \"donor\.read\"\)/);
    expect(donors).toMatch(/financialRepository\.listDonors/);
    expect(donors).not.toMatch(/from \"@\/lib\/db\"/);
    expect(donations).toMatch(/requireTenantContext/);
    expect(donations).toMatch(/requirePermission\(context, \"donation\.read\"\)/);
    expect(donations).toMatch(/financialRepository\.listDonations/);
    expect(donations).not.toMatch(/from "@\/lib\/db"/);
  });

  it("keeps projects APIs and report generation on tenant-bound authority", () => {
    const projects = source("src/app/api/projects/route.ts");
    const project = source("src/app/api/projects/[id]/route.ts");
    const reports = source("src/modules/reports/report-service.ts");
    expect(projects).toMatch(/requirePermission\(context, "project\.read"\)/);
    expect(projects).toMatch(/financialRepository\.createProject/);
    expect(project).toMatch(/requirePermission\(context, "project\.update"\)/);
    expect(project).toMatch(/financialRepository\.deleteProject/);
    expect(projects).not.toMatch(/from "@\/lib\/db"/);
    expect(project).not.toMatch(/from "@\/lib\/db"/);
    expect(reports).toMatch(/requireTenantBoundPrismaExecutor/);
    expect(reports).not.toMatch(/from "@\/lib\/db"/);
  });
});
