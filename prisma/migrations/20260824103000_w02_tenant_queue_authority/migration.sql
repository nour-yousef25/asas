-- W02 deployment contract: each tenant principal may reference one opaque queue credential.
-- The credential value remains outside Git and is never a client-provided tenant authority.
ALTER TABLE "tenant_database_principals"
  ADD COLUMN "queueCredentialReference" TEXT;

CREATE UNIQUE INDEX "tenant_database_principals_queueCredentialReference_key"
  ON "tenant_database_principals"("queueCredentialReference");
