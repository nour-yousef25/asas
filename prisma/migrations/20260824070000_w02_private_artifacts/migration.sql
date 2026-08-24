-- W02 private artifacts are metadata-first. Provider credentials and object delivery
-- remain deployment-owned and never enter this schema or application fallback paths.

CREATE TABLE "private_artifacts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "private_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "private_artifacts_documentId_key" ON "private_artifacts"("documentId");
CREATE UNIQUE INDEX "private_artifacts_objectKey_key" ON "private_artifacts"("objectKey");
CREATE INDEX "private_artifacts_organizationId_state_idx" ON "private_artifacts"("organizationId", "state");
ALTER TABLE "private_artifacts" ADD CONSTRAINT "private_artifacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "private_artifacts" ADD CONSTRAINT "private_artifacts_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents FORCE ROW LEVEL SECURITY;
CREATE POLICY document_session_user_tenant_isolation
    ON public.documents
    FOR ALL
    USING ("organizationId" IS NOT NULL AND "organizationId" = security.current_session_organization_id())
    WITH CHECK ("organizationId" IS NOT NULL AND "organizationId" = security.current_session_organization_id());

ALTER TABLE public.private_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_artifacts FORCE ROW LEVEL SECURITY;
CREATE POLICY private_artifact_session_user_tenant_isolation
    ON public.private_artifacts
    FOR ALL
    USING ("organizationId" = security.current_session_organization_id())
    WITH CHECK ("organizationId" = security.current_session_organization_id());
