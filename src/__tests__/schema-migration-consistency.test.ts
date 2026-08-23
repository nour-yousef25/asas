import { readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const schemaPath = path.join(projectRoot, "prisma/schema.prisma");
const migrationPath = path.join(
  projectRoot,
  "prisma/migrations/20260822060000_align_canonical_schema_non_destructive/migration.sql",
);

describe("W01 schema/migration consistency fix", () => {
  it("keeps the canonical runtime contract on enum-backed users.role", async () => {
    const schema = await readFile(schemaPath, "utf8");
    expect(schema).toMatch(/role\s+Role\s+@default\(MEMBER\)/);
    expect(schema).toContain("enum Role {");
    expect(schema).not.toContain("roleId        String?");
  });

  it("uses a forward-only non-destructive migration to reconcile legacy schema", async () => {
    const migration = await readFile(migrationPath, "utf8");
    expect(migration).toContain('ALTER TABLE "users" ADD COLUMN "role" "Role"');
    expect(migration).toContain('FROM "roles" AS "legacy_role"');
    expect(migration).toContain('ALTER TABLE "members" ADD COLUMN "endDate"');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
    expect(migration).toContain("preserves legacy users.roleId, roles, role_permissions");
  });
});
