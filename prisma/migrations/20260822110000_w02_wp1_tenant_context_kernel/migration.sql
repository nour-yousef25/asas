-- W02 WP1: additive tenant-context and session/policy-versioning primitives.
-- Forward-only, non-destructive, and intentionally does not backfill tenant keys.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "authVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "activeOrganizationId" TEXT;

ALTER TABLE "organization_memberships"
  ADD COLUMN IF NOT EXISTS "policyVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);

ALTER TABLE "users"
  ADD CONSTRAINT "users_activeOrganizationId_fkey"
  FOREIGN KEY ("activeOrganizationId") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "users_activeOrganizationId_idx"
  ON "users"("activeOrganizationId");

CREATE INDEX IF NOT EXISTS "organization_memberships_organizationId_userId_policyVersion_idx"
  ON "organization_memberships"("organizationId", "userId", "policyVersion");
