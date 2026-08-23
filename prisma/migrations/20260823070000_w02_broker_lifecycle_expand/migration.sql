-- W02 Broker lifecycle metadata: additive, credential-free, forward-only.
-- Tenant credentials are intentionally external to this database and Git.
CREATE TYPE "TenantDatabasePrincipalStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "TenantAccessLeaseStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'REVOKED', 'EXPIRED');

CREATE TABLE "tenant_database_principals" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "principalName" TEXT NOT NULL,
  "credentialReference" TEXT NOT NULL,
  "generation" INTEGER NOT NULL DEFAULT 1,
  "status" "TenantDatabasePrincipalStatus" NOT NULL DEFAULT 'ACTIVE',
  "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_database_principals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_access_leases" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tenantDatabasePrincipalId" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "contextFingerprint" TEXT NOT NULL,
  "status" "TenantAccessLeaseStatus" NOT NULL DEFAULT 'ACTIVE',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_access_leases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_broker_audit_events" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "membershipId" TEXT,
  "userId" TEXT,
  "tenantDatabasePrincipalId" TEXT,
  "leaseId" TEXT,
  "correlationId" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_broker_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_database_principals_principalName_key" ON "tenant_database_principals"("principalName");
CREATE UNIQUE INDEX "tenant_database_principals_credentialReference_key" ON "tenant_database_principals"("credentialReference");
CREATE UNIQUE INDEX "tenant_database_principals_one_active_per_organization" ON "tenant_database_principals"("organizationId") WHERE "status" = 'ACTIVE';
CREATE INDEX "tenant_database_principals_organizationId_generation_idx" ON "tenant_database_principals"("organizationId", "generation");
CREATE UNIQUE INDEX "tenant_access_leases_connectionId_key" ON "tenant_access_leases"("connectionId");
CREATE INDEX "tenant_access_leases_organizationId_status_expiresAt_idx" ON "tenant_access_leases"("organizationId", "status", "expiresAt");
CREATE INDEX "tenant_access_leases_membershipId_status_idx" ON "tenant_access_leases"("membershipId", "status");
CREATE INDEX "tenant_access_leases_userId_status_idx" ON "tenant_access_leases"("userId", "status");
CREATE INDEX "tenant_access_leases_correlationId_idx" ON "tenant_access_leases"("correlationId");
CREATE INDEX "tenant_broker_audit_events_organizationId_createdAt_idx" ON "tenant_broker_audit_events"("organizationId", "createdAt");
CREATE INDEX "tenant_broker_audit_events_correlationId_idx" ON "tenant_broker_audit_events"("correlationId");
CREATE INDEX "tenant_broker_audit_events_leaseId_idx" ON "tenant_broker_audit_events"("leaseId");

ALTER TABLE "tenant_database_principals" ADD CONSTRAINT "tenant_database_principals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_access_leases" ADD CONSTRAINT "tenant_access_leases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_access_leases" ADD CONSTRAINT "tenant_access_leases_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "organization_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_access_leases" ADD CONSTRAINT "tenant_access_leases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_access_leases" ADD CONSTRAINT "tenant_access_leases_tenantDatabasePrincipalId_fkey" FOREIGN KEY ("tenantDatabasePrincipalId") REFERENCES "tenant_database_principals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_broker_audit_events" ADD CONSTRAINT "tenant_broker_audit_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tenant_broker_audit_events" ADD CONSTRAINT "tenant_broker_audit_events_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "organization_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tenant_broker_audit_events" ADD CONSTRAINT "tenant_broker_audit_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
