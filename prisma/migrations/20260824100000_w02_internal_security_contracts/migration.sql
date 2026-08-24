-- W02 internal Vault/Privacy/Activation/IdP contracts.
-- Only opaque references, hashes and redacted metadata. No provider credentials or plaintext secrets.

CREATE TYPE "SecretRecordStatus" AS ENUM ('ACTIVE', 'ROTATED', 'REVOKED');
CREATE TYPE "DataClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');
CREATE TYPE "PrivacyRequestType" AS ENUM ('ACCESS', 'EXPORT', 'DELETE', 'CORRECT');
CREATE TYPE "PrivacyRequestStatus" AS ENUM ('REQUESTED', 'POLICY_REQUIRED', 'APPROVED', 'REJECTED', 'LEGAL_HOLD', 'COMPLETED');
CREATE TYPE "ActivationStatus" AS ENUM ('PENDING', 'ACTIVATED', 'REVOKED', 'EXPIRED');
CREATE TYPE "IdentityProviderEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');
CREATE TYPE "IdentityProviderStatus" AS ENUM ('ACTIVE', 'DISABLED', 'REVOKED');

CREATE TABLE "secret_records" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "opaqueReference" TEXT NOT NULL,
  "keyVersion" TEXT NOT NULL,
  "status" "SecretRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "rotatedFromId" TEXT,
  "createdById" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "secret_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "secret_records_organizationId_providerKey_purpose_keyVersion_key" ON "secret_records"("organizationId", "providerKey", "purpose", "keyVersion");
CREATE INDEX "secret_records_organizationId_providerKey_purpose_status_idx" ON "secret_records"("organizationId", "providerKey", "purpose", "status");
ALTER TABLE "secret_records" ADD CONSTRAINT "secret_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "secret_access_audits" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "secretRecordId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "secret_access_audits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "secret_access_audits_organizationId_secretRecordId_createdAt_idx" ON "secret_access_audits"("organizationId", "secretRecordId", "createdAt");
CREATE INDEX "secret_access_audits_correlationId_idx" ON "secret_access_audits"("correlationId");
ALTER TABLE "secret_access_audits" ADD CONSTRAINT "secret_access_audits_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "secret_access_audits" ADD CONSTRAINT "secret_access_audits_secretRecordId_fkey" FOREIGN KEY ("secretRecordId") REFERENCES "secret_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "privacy_policy_bindings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "recordType" TEXT NOT NULL,
  "classification" "DataClassification" NOT NULL,
  "policyReference" TEXT,
  "isApproved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "privacy_policy_bindings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "privacy_policy_bindings_organizationId_recordType_key" ON "privacy_policy_bindings"("organizationId", "recordType");
CREATE INDEX "privacy_policy_bindings_organizationId_classification_isApproved_idx" ON "privacy_policy_bindings"("organizationId", "classification", "isApproved");
ALTER TABLE "privacy_policy_bindings" ADD CONSTRAINT "privacy_policy_bindings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "privacy_requests" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "type" "PrivacyRequestType" NOT NULL,
  "recordType" TEXT NOT NULL,
  "classification" "DataClassification" NOT NULL,
  "purposeCode" TEXT NOT NULL,
  "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'POLICY_REQUIRED',
  "legalHold" BOOLEAN NOT NULL DEFAULT false,
  "decisionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "privacy_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "privacy_requests_organizationId_status_createdAt_idx" ON "privacy_requests"("organizationId", "status", "createdAt");
CREATE INDEX "privacy_requests_organizationId_requesterId_createdAt_idx" ON "privacy_requests"("organizationId", "requesterId", "createdAt");
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "activation_records" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "licenseKeyId" TEXT NOT NULL,
  "instanceId" TEXT NOT NULL,
  "certificateFingerprint" TEXT NOT NULL,
  "activationCodeHash" TEXT NOT NULL,
  "activationCodeSalt" TEXT NOT NULL,
  "status" "ActivationStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "activation_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "activation_records_organizationId_licenseKeyId_instanceId_key" ON "activation_records"("organizationId", "licenseKeyId", "instanceId");
CREATE INDEX "activation_records_organizationId_status_expiresAt_idx" ON "activation_records"("organizationId", "status", "expiresAt");
ALTER TABLE "activation_records" ADD CONSTRAINT "activation_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "identity_provider_configs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL,
  "environment" "IdentityProviderEnvironment" NOT NULL,
  "clientSecretRefId" TEXT,
  "issuerUri" TEXT,
  "subjectClaim" TEXT NOT NULL DEFAULT 'sub',
  "status" "IdentityProviderStatus" NOT NULL DEFAULT 'DISABLED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "identity_provider_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "identity_provider_configs_organizationId_providerKey_environment_key" ON "identity_provider_configs"("organizationId", "providerKey", "environment");
CREATE INDEX "identity_provider_configs_organizationId_status_idx" ON "identity_provider_configs"("organizationId", "status");
ALTER TABLE "identity_provider_configs" ADD CONSTRAINT "identity_provider_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "identity_subject_bindings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "identityProviderConfigId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "subjectHash" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "identity_subject_bindings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "identity_subject_bindings_identityProviderConfigId_subjectHash_key" ON "identity_subject_bindings"("identityProviderConfigId", "subjectHash");
CREATE UNIQUE INDEX "identity_subject_bindings_identityProviderConfigId_membershipId_key" ON "identity_subject_bindings"("identityProviderConfigId", "membershipId");
CREATE INDEX "identity_subject_bindings_organizationId_membershipId_isActive_idx" ON "identity_subject_bindings"("organizationId", "membershipId", "isActive");
ALTER TABLE "identity_subject_bindings" ADD CONSTRAINT "identity_subject_bindings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "identity_subject_bindings" ADD CONSTRAINT "identity_subject_bindings_identityProviderConfigId_fkey" FOREIGN KEY ("identityProviderConfigId") REFERENCES "identity_provider_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "identity_provider_callback_states" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "identityProviderConfigId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "identity_provider_callback_states_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "identity_provider_callback_states_stateHash_key" ON "identity_provider_callback_states"("stateHash");
CREATE INDEX "identity_provider_callback_states_organizationId_expiresAt_idx" ON "identity_provider_callback_states"("organizationId", "expiresAt");
CREATE INDEX "identity_provider_callback_states_identityProviderConfigId_expiresAt_idx" ON "identity_provider_callback_states"("identityProviderConfigId", "expiresAt");
ALTER TABLE "identity_provider_callback_states" ADD CONSTRAINT "identity_provider_callback_states_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "identity_provider_callback_states" ADD CONSTRAINT "identity_provider_callback_states_identityProviderConfigId_fkey" FOREIGN KEY ("identityProviderConfigId") REFERENCES "identity_provider_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every tenant-owned W02 table uses session_user mapped through the protected role-OID map.
ALTER TABLE public.secret_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secret_records FORCE ROW LEVEL SECURITY;
CREATE POLICY secret_record_session_user_tenant_isolation ON public.secret_records FOR ALL
  USING ("organizationId" = security.current_session_organization_id())
  WITH CHECK ("organizationId" = security.current_session_organization_id());

ALTER TABLE public.secret_access_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secret_access_audits FORCE ROW LEVEL SECURITY;
CREATE POLICY secret_access_audit_session_user_tenant_isolation ON public.secret_access_audits FOR ALL
  USING ("organizationId" = security.current_session_organization_id())
  WITH CHECK ("organizationId" = security.current_session_organization_id()
    AND EXISTS (SELECT 1 FROM public.secret_records AS record WHERE record.id = "secretRecordId" AND record."organizationId" = security.current_session_organization_id()));

ALTER TABLE public.privacy_policy_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_policy_bindings FORCE ROW LEVEL SECURITY;
CREATE POLICY privacy_policy_binding_session_user_tenant_isolation ON public.privacy_policy_bindings FOR ALL
  USING ("organizationId" = security.current_session_organization_id())
  WITH CHECK ("organizationId" = security.current_session_organization_id());

ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY privacy_request_session_user_tenant_isolation ON public.privacy_requests FOR ALL
  USING ("organizationId" = security.current_session_organization_id())
  WITH CHECK ("organizationId" = security.current_session_organization_id());

ALTER TABLE public.activation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activation_records FORCE ROW LEVEL SECURITY;
CREATE POLICY activation_record_session_user_tenant_isolation ON public.activation_records FOR ALL
  USING ("organizationId" = security.current_session_organization_id())
  WITH CHECK ("organizationId" = security.current_session_organization_id());

ALTER TABLE public.identity_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_provider_configs FORCE ROW LEVEL SECURITY;
CREATE POLICY identity_provider_config_session_user_tenant_isolation ON public.identity_provider_configs FOR ALL
  USING ("organizationId" = security.current_session_organization_id())
  WITH CHECK ("organizationId" = security.current_session_organization_id());

ALTER TABLE public.identity_subject_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_subject_bindings FORCE ROW LEVEL SECURITY;
CREATE POLICY identity_subject_binding_session_user_tenant_isolation ON public.identity_subject_bindings FOR ALL
  USING ("organizationId" = security.current_session_organization_id())
  WITH CHECK ("organizationId" = security.current_session_organization_id()
    AND EXISTS (SELECT 1 FROM public.identity_provider_configs AS config WHERE config.id = "identityProviderConfigId" AND config."organizationId" = security.current_session_organization_id()));

ALTER TABLE public.identity_provider_callback_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_provider_callback_states FORCE ROW LEVEL SECURITY;
CREATE POLICY identity_callback_state_session_user_tenant_isolation ON public.identity_provider_callback_states FOR ALL
  USING ("organizationId" = security.current_session_organization_id())
  WITH CHECK ("organizationId" = security.current_session_organization_id()
    AND EXISTS (SELECT 1 FROM public.identity_provider_configs AS config WHERE config.id = "identityProviderConfigId" AND config."organizationId" = security.current_session_organization_id()));
