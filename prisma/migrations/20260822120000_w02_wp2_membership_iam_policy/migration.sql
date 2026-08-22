-- W02 WP2: additive membership-scoped IAM and policy primitives.
CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');
CREATE TYPE "PlatformSupportAccessStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REVOKED', 'EXPIRED');

CREATE TABLE "organization_roles" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organization_role_permissions" (
  "organizationRoleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "effect" "PermissionEffect" NOT NULL DEFAULT 'ALLOW',
  CONSTRAINT "organization_role_permissions_pkey" PRIMARY KEY ("organizationRoleId", "permissionId")
);

CREATE TABLE "membership_roles" (
  "membershipId" TEXT NOT NULL,
  "organizationRoleId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "membership_roles_pkey" PRIMARY KEY ("membershipId", "organizationRoleId")
);

CREATE TABLE "membership_permission_overrides" (
  "membershipId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "effect" "PermissionEffect" NOT NULL,
  "reason" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "membership_permission_overrides_pkey" PRIMARY KEY ("membershipId", "permissionId")
);

CREATE TABLE "platform_support_access" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "approverId" TEXT,
  "status" "PlatformSupportAccessStatus" NOT NULL DEFAULT 'REQUESTED',
  "reason" TEXT NOT NULL,
  "purposeCode" TEXT NOT NULL,
  "readOnly" BOOLEAN NOT NULL DEFAULT true,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "platform_support_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_roles_organizationId_name_key" ON "organization_roles"("organizationId", "name");
CREATE INDEX "organization_roles_organizationId_isSystem_idx" ON "organization_roles"("organizationId", "isSystem");
CREATE INDEX "membership_permission_overrides_membershipId_expiresAt_idx" ON "membership_permission_overrides"("membershipId", "expiresAt");
CREATE INDEX "platform_support_access_organizationId_status_expiresAt_idx" ON "platform_support_access"("organizationId", "status", "expiresAt");
CREATE INDEX "platform_support_access_requesterId_status_idx" ON "platform_support_access"("requesterId", "status");

ALTER TABLE "organization_roles" ADD CONSTRAINT "organization_roles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_role_permissions" ADD CONSTRAINT "organization_role_permissions_organizationRoleId_fkey" FOREIGN KEY ("organizationRoleId") REFERENCES "organization_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_role_permissions" ADD CONSTRAINT "organization_role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "organization_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_organizationRoleId_fkey" FOREIGN KEY ("organizationRoleId") REFERENCES "organization_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "membership_permission_overrides" ADD CONSTRAINT "membership_permission_overrides_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "organization_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "membership_permission_overrides" ADD CONSTRAINT "membership_permission_overrides_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_support_access" ADD CONSTRAINT "platform_support_access_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_support_access" ADD CONSTRAINT "platform_support_access_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_support_access" ADD CONSTRAINT "platform_support_access_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
