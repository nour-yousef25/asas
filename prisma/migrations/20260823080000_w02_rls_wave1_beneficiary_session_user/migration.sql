-- W02 RLS Wave 1. The authenticated PostgreSQL session_user is the only
-- tenant identity anchor. This migration intentionally covers only the
-- Beneficiary family and tenant-scoped audit writes used by that family.

CREATE SCHEMA IF NOT EXISTS security;
REVOKE ALL ON SCHEMA security FROM PUBLIC;

CREATE TABLE security.role_to_organization (
    role_oid oid NOT NULL,
    organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    activated_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (role_oid, organization_id, activated_at)
);

CREATE UNIQUE INDEX security_role_to_organization_active_role_key
    ON security.role_to_organization (role_oid)
    WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX security_role_to_organization_active_organization_key
    ON security.role_to_organization (organization_id)
    WHERE revoked_at IS NULL;

REVOKE ALL ON TABLE security.role_to_organization FROM PUBLIC;

CREATE FUNCTION security.current_session_organization_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, security
AS $$
    SELECT mapping.organization_id
    FROM security.role_to_organization AS mapping
    WHERE mapping.role_oid = (session_user::regrole)::oid
      AND mapping.revoked_at IS NULL
$$;

REVOKE ALL ON FUNCTION security.current_session_organization_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION security.current_session_organization_id() TO PUBLIC;

ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaries FORCE ROW LEVEL SECURITY;
CREATE POLICY beneficiary_session_user_tenant_isolation
    ON public.beneficiaries
    FOR ALL
    USING (
        "organizationId" IS NOT NULL
        AND "organizationId" = security.current_session_organization_id()
    )
    WITH CHECK (
        "organizationId" IS NOT NULL
        AND "organizationId" = security.current_session_organization_id()
    );

ALTER TABLE public.beneficiary_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiary_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY beneficiary_document_session_user_tenant_isolation
    ON public.beneficiary_documents
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM public.beneficiaries AS beneficiary
            WHERE beneficiary.id = "beneficiaryId"
              AND beneficiary."organizationId" = security.current_session_organization_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.beneficiaries AS beneficiary
            WHERE beneficiary.id = "beneficiaryId"
              AND beneficiary."organizationId" = security.current_session_organization_id()
        )
    );

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY beneficiary_audit_log_session_user_tenant_isolation
    ON public.audit_logs
    FOR ALL
    USING (
        "organizationId" IS NOT NULL
        AND "organizationId" = security.current_session_organization_id()
    )
    WITH CHECK (
        "organizationId" IS NOT NULL
        AND "organizationId" = security.current_session_organization_id()
    );
