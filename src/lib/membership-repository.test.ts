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

  it("keeps IAM and policy membership data-plane tenant-bound", () => {
    const source = ["src/lib/iam.ts", "src/lib/policy.ts"].map((path) => readFileSync(path, "utf8")).join("\n");
    expect(source).toMatch(/requireTenantBoundPrismaExecutor/);
    expect(source).not.toMatch(/from "@\/lib\/db"|\bprisma\.|current_setting|set_config|DATABASE_URL/);
  });

  it("quarantines the unauthorised global identity surface and removes dashboard callers", () => {
    const usersRoute = readFileSync("src/app/api/users/route.ts", "utf8");
    const callers = [
      "src/app/(dashboard)/tasks/page.tsx",
      "src/app/(dashboard)/performance/evaluations/page.tsx",
      "src/app/(dashboard)/members/register/page.tsx",
    ].map((path) => readFileSync(path, "utf8")).join("\n");

    expect(usersRoute).toMatch(/GLOBAL_IDENTITY_SURFACE_QUARANTINED/);
    expect(usersRoute).toMatch(/status: 410/);
    expect(usersRoute).not.toMatch(/from "@\/lib\/db"|\bprisma\.|auth\(|activeOrganizationId|organizationMemberships\[0\]/);
    expect(callers).not.toMatch(/\/api\/users/);
  });
});
