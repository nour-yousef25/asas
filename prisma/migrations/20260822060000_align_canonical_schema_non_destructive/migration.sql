-- W01-SCHEMA-MIGRATION-CONSISTENCY-FIX
-- Forward-only alignment with the canonical Prisma schema. Historical migrations stay intact.
-- This migration intentionally preserves legacy users.roleId, roles, role_permissions, and members.membershipExpiryDate.

CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'EDITOR', 'MEMBER', 'DONOR', 'VOLUNTEER', 'BENEFICIARY', 'EMPLOYEE');
CREATE TYPE "SocialPlatform" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TIKTOK', 'YOUTUBE', 'X');
CREATE TYPE "ConnectedChannelStatus" AS ENUM ('CONFIGURATION_REQUIRED', 'READY', 'NEEDS_REAUTH', 'RESTRICTED', 'DISCONNECTED', 'ERROR');
CREATE TYPE "CommunicationContentType" AS ENUM ('NEWS', 'EVENT', 'PROJECT', 'DONATION_CAMPAIGN', 'ACHIEVEMENT', 'SUCCESS_STORY', 'INDEPENDENT');
CREATE TYPE "CommunicationWorkflowStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED', 'ARCHIVED');
CREATE TYPE "PublicationErrorClass" AS ENUM ('TOKEN_EXPIRED', 'PERMISSION_DENIED', 'RATE_LIMIT', 'INVALID_MEDIA', 'UNSUPPORTED_FORMAT', 'PROVIDER_TIMEOUT', 'PROVIDER_OUTAGE', 'ACCESS_REVOKED', 'ACCOUNT_REMOVED', 'APP_REVIEW_RESTRICTION', 'CONFIGURATION_REQUIRED', 'UNKNOWN');
CREATE TYPE "MetricKind" AS ENUM ('VIEWS', 'REACH', 'ENGAGEMENT', 'LIKES', 'COMMENTS', 'SHARES', 'CLICKS', 'FOLLOWERS', 'VIDEO_VIEWS');
CREATE TYPE "AIProposalType" AS ENUM ('DRAFT', 'REWRITE', 'CHANNEL_ADAPTATION', 'TITLE', 'CTA', 'HASHTAGS', 'CAMPAIGN', 'SCHEDULE');

-- Restore the canonical enum-backed role while retaining the legacy relational representation.
ALTER TABLE "users" ADD COLUMN "role" "Role";
UPDATE "users" AS "user"
SET "role" = CASE COALESCE("legacy_role"."name", '')
  WHEN 'SUPER_ADMIN' THEN 'SUPER_ADMIN'::"Role"
  WHEN 'ADMIN' THEN 'ADMIN'::"Role"
  WHEN 'EDITOR' THEN 'EDITOR'::"Role"
  WHEN 'DONOR' THEN 'DONOR'::"Role"
  WHEN 'VOLUNTEER' THEN 'VOLUNTEER'::"Role"
  WHEN 'BENEFICIARY' THEN 'BENEFICIARY'::"Role"
  WHEN 'EMPLOYEE' THEN 'EMPLOYEE'::"Role"
  ELSE 'MEMBER'::"Role"
END
FROM "roles" AS "legacy_role"
WHERE "legacy_role"."id" = "user"."roleId";
UPDATE "users" SET "role" = 'MEMBER'::"Role" WHERE "role" IS NULL;
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;

-- Preserve historical membershipExpiryDate and add the canonical endDate without losing values.
ALTER TABLE "members" ADD COLUMN "endDate" TIMESTAMP(3);
UPDATE "members" SET "endDate" = "membershipExpiryDate" WHERE "endDate" IS NULL AND "membershipExpiryDate" IS NOT NULL;
ALTER TABLE "audit_logs" ADD COLUMN "organizationId" TEXT;

CREATE TABLE "organization_memberships" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'MEMBER',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "connected_channels" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "platform" "SocialPlatform" NOT NULL,
  "externalId" TEXT NOT NULL, "displayName" TEXT NOT NULL, "accountType" TEXT,
  "status" "ConnectedChannelStatus" NOT NULL DEFAULT 'CONFIGURATION_REQUIRED',
  "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[], "capabilities" JSONB NOT NULL, "lastSyncedAt" TIMESTAMP(3),
  "reauthReason" TEXT, "metadata" JSONB, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "connected_channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "channel_credentials" (
  "id" TEXT NOT NULL, "connectedChannelId" TEXT NOT NULL, "encryptedAccessToken" TEXT NOT NULL,
  "encryptedRefreshToken" TEXT, "encryptionVersion" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3), "refreshExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "channel_credentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brand_voice_kits" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "tone" TEXT,
  "preferredTerms" TEXT[] DEFAULT ARRAY[]::TEXT[], "forbiddenTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "officialHashtags" TEXT[] DEFAULT ARRAY[]::TEXT[], "contactInformation" TEXT, "defaultCta" TEXT,
  "identityNotes" TEXT, "templates" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "brand_voice_kits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "communication_campaigns" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "title" TEXT NOT NULL, "objective" TEXT,
  "relatedEntityType" TEXT, "relatedEntityId" TEXT, "startDate" TIMESTAMP(3), "endDate" TIMESTAMP(3),
  "ownerId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "communication_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "communication_content_items" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "campaignId" TEXT, "sourceType" TEXT,
  "sourceId" TEXT, "type" "CommunicationContentType" NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL,
  "status" "CommunicationWorkflowStatus" NOT NULL DEFAULT 'DRAFT', "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "assetUrls" TEXT[] DEFAULT ARRAY[]::TEXT[], "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "communication_content_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "channel_variants" (
  "id" TEXT NOT NULL, "contentItemId" TEXT NOT NULL, "connectedChannelId" TEXT NOT NULL,
  "platform" "SocialPlatform" NOT NULL, "title" TEXT, "copy" TEXT NOT NULL, "payload" JSONB,
  "assetUrls" TEXT[] DEFAULT ARRAY[]::TEXT[], "status" "CommunicationWorkflowStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1, "validation" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "channel_variants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "communication_reviews" (
  "id" TEXT NOT NULL, "channelVariantId" TEXT NOT NULL, "reviewerId" TEXT NOT NULL,
  "decision" "CommunicationWorkflowStatus" NOT NULL, "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "communication_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "publication_plans" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "channelVariantId" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3), "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh',
  "status" "CommunicationWorkflowStatus" NOT NULL DEFAULT 'APPROVED', "approvedById" TEXT,
  "cancelledAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "publication_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "publication_attempts" (
  "id" TEXT NOT NULL, "publicationPlanId" TEXT NOT NULL, "attemptNumber" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "providerPublicationId" TEXT, "providerUrl" TEXT,
  "status" "CommunicationWorkflowStatus" NOT NULL, "errorClass" "PublicationErrorClass", "errorCode" TEXT,
  "userMessage" TEXT, "technicalMessage" TEXT, "providerTraceId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
  CONSTRAINT "publication_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webhook_events" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "platform" "SocialPlatform" NOT NULL,
  "externalEventId" TEXT NOT NULL, "connectedChannelExternalId" TEXT, "signatureValid" BOOLEAN NOT NULL DEFAULT false,
  "payload" JSONB NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3), "processingError" TEXT, CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "metric_snapshots" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "connectedChannelId" TEXT NOT NULL,
  "channelVariantId" TEXT, "metric" "MetricKind" NOT NULL, "value" DOUBLE PRECISION NOT NULL,
  "providerPeriodFrom" TIMESTAMP(3), "providerPeriodTo" TIMESTAMP(3),
  "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "raw" JSONB,
  CONSTRAINT "metric_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_proposals" (
  "id" TEXT NOT NULL, "contentItemId" TEXT NOT NULL, "requestedById" TEXT NOT NULL, "type" "AIProposalType" NOT NULL,
  "input" JSONB, "output" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_proposals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_states" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "userId" TEXT NOT NULL, "platform" "SocialPlatform" NOT NULL,
  "state" TEXT NOT NULL, "codeVerifier" TEXT, "redirectUri" TEXT NOT NULL, "requestedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "organization_memberships_userId_isActive_idx" ON "organization_memberships"("userId", "isActive");
CREATE INDEX "organization_memberships_organizationId_isActive_idx" ON "organization_memberships"("organizationId", "isActive");
CREATE UNIQUE INDEX "organization_memberships_organizationId_userId_key" ON "organization_memberships"("organizationId", "userId");
CREATE INDEX "connected_channels_organizationId_platform_status_idx" ON "connected_channels"("organizationId", "platform", "status");
CREATE UNIQUE INDEX "connected_channels_organizationId_platform_externalId_key" ON "connected_channels"("organizationId", "platform", "externalId");
CREATE UNIQUE INDEX "channel_credentials_connectedChannelId_key" ON "channel_credentials"("connectedChannelId");
CREATE UNIQUE INDEX "brand_voice_kits_organizationId_key" ON "brand_voice_kits"("organizationId");
CREATE INDEX "communication_campaigns_organizationId_startDate_idx" ON "communication_campaigns"("organizationId", "startDate");
CREATE INDEX "communication_content_items_organizationId_status_createdAt_idx" ON "communication_content_items"("organizationId", "status", "createdAt");
CREATE INDEX "communication_content_items_organizationId_sourceType_sourc_idx" ON "communication_content_items"("organizationId", "sourceType", "sourceId");
CREATE INDEX "channel_variants_connectedChannelId_status_idx" ON "channel_variants"("connectedChannelId", "status");
CREATE UNIQUE INDEX "channel_variants_contentItemId_connectedChannelId_key" ON "channel_variants"("contentItemId", "connectedChannelId");
CREATE INDEX "communication_reviews_channelVariantId_createdAt_idx" ON "communication_reviews"("channelVariantId", "createdAt");
CREATE INDEX "publication_plans_organizationId_status_scheduledAt_idx" ON "publication_plans"("organizationId", "status", "scheduledAt");
CREATE INDEX "publication_plans_channelVariantId_scheduledAt_idx" ON "publication_plans"("channelVariantId", "scheduledAt");
CREATE UNIQUE INDEX "publication_attempts_idempotencyKey_key" ON "publication_attempts"("idempotencyKey");
CREATE INDEX "publication_attempts_publicationPlanId_status_idx" ON "publication_attempts"("publicationPlanId", "status");
CREATE UNIQUE INDEX "publication_attempts_publicationPlanId_attemptNumber_key" ON "publication_attempts"("publicationPlanId", "attemptNumber");
CREATE INDEX "webhook_events_platform_receivedAt_idx" ON "webhook_events"("platform", "receivedAt");
CREATE UNIQUE INDEX "webhook_events_organizationId_platform_externalEventId_key" ON "webhook_events"("organizationId", "platform", "externalEventId");
CREATE INDEX "metric_snapshots_organizationId_metric_collectedAt_idx" ON "metric_snapshots"("organizationId", "metric", "collectedAt");
CREATE INDEX "metric_snapshots_connectedChannelId_collectedAt_idx" ON "metric_snapshots"("connectedChannelId", "collectedAt");
CREATE INDEX "ai_proposals_contentItemId_type_createdAt_idx" ON "ai_proposals"("contentItemId", "type", "createdAt");
CREATE UNIQUE INDEX "oauth_states_state_key" ON "oauth_states"("state");
CREATE INDEX "oauth_states_organizationId_platform_expiresAt_idx" ON "oauth_states"("organizationId", "platform", "expiresAt");
CREATE INDEX "oauth_states_userId_expiresAt_idx" ON "oauth_states"("userId", "expiresAt");
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt");

ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connected_channels" ADD CONSTRAINT "connected_channels_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connected_channels" ADD CONSTRAINT "connected_channels_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "channel_credentials" ADD CONSTRAINT "channel_credentials_connectedChannelId_fkey" FOREIGN KEY ("connectedChannelId") REFERENCES "connected_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brand_voice_kits" ADD CONSTRAINT "brand_voice_kits_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communication_campaigns" ADD CONSTRAINT "communication_campaigns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communication_campaigns" ADD CONSTRAINT "communication_campaigns_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "communication_content_items" ADD CONSTRAINT "communication_content_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communication_content_items" ADD CONSTRAINT "communication_content_items_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "communication_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "communication_content_items" ADD CONSTRAINT "communication_content_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "channel_variants" ADD CONSTRAINT "channel_variants_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "communication_content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_variants" ADD CONSTRAINT "channel_variants_connectedChannelId_fkey" FOREIGN KEY ("connectedChannelId") REFERENCES "connected_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communication_reviews" ADD CONSTRAINT "communication_reviews_channelVariantId_fkey" FOREIGN KEY ("channelVariantId") REFERENCES "channel_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communication_reviews" ADD CONSTRAINT "communication_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "publication_plans" ADD CONSTRAINT "publication_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "publication_plans" ADD CONSTRAINT "publication_plans_channelVariantId_fkey" FOREIGN KEY ("channelVariantId") REFERENCES "channel_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "publication_plans" ADD CONSTRAINT "publication_plans_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "publication_attempts" ADD CONSTRAINT "publication_attempts_publicationPlanId_fkey" FOREIGN KEY ("publicationPlanId") REFERENCES "publication_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "metric_snapshots" ADD CONSTRAINT "metric_snapshots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "metric_snapshots" ADD CONSTRAINT "metric_snapshots_connectedChannelId_fkey" FOREIGN KEY ("connectedChannelId") REFERENCES "connected_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "communication_content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
