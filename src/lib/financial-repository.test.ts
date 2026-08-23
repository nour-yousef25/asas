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
    expect(donations).not.toMatch(/from \"@\/lib\/db\"/);
  });
});
