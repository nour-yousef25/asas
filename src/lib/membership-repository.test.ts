import { readFileSync } from "node:fs";

describe("Membership tenant-bound cutover guard", () => {
  it("forbids global Prisma, raw GUC, and implicit tenant fallback", () => {
    const source = readFileSync("src/lib/membership-repository.ts", "utf8");
    expect(source).not.toMatch(/from "@\/lib\/db"|new PrismaClient|current_setting|set_config|DATABASE_URL|organizationMemberships\[0\]|activeOrganizationId/);
    expect(source).toMatch(/TenantBoundPrismaExecutor/);
  });

  it("requires context and membership permissions before repository access", () => {
    const source = readFileSync("src/app/api/memberships/route.ts", "utf8");
    expect(source).toMatch(/requireTenantContext\(\)/);
    expect(source).toMatch(/identity\.membership\.read/);
    expect(source).toMatch(/identity\.membership\.manage/);
    expect(source).not.toMatch(/from "@\/lib\/db"|prisma\./);
  });
});
