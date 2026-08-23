-- W02 dashboard nullable-root ownership: expand-only, default-deny admission, no RLS policy.
ALTER TABLE "members" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "kpis" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "kpi_records" ADD COLUMN "organizationId" TEXT;

CREATE INDEX "members_organizationId_idx" ON "members"("organizationId");
CREATE INDEX "kpis_organizationId_idx" ON "kpis"("organizationId");
CREATE INDEX "kpi_records_organizationId_idx" ON "kpi_records"("organizationId");

ALTER TABLE "members" ADD CONSTRAINT "members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kpi_records" ADD CONSTRAINT "kpi_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE SCHEMA IF NOT EXISTS control;
REVOKE ALL ON SCHEMA control FROM PUBLIC;

CREATE TABLE control.nullable_root_backfill_assignments (
    id uuid PRIMARY KEY,
    operation_id uuid NOT NULL,
    root_table text NOT NULL CHECK (root_table IN ('members', 'kpis')),
    record_id text NOT NULL,
    organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    manifest_digest text NOT NULL CHECK (length(manifest_digest) = 64),
    created_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    UNIQUE (operation_id, root_table, record_id),
    UNIQUE (root_table, record_id, manifest_digest)
);
CREATE INDEX nullable_root_backfill_assignments_active_idx
    ON control.nullable_root_backfill_assignments(root_table, record_id, organization_id)
    WHERE revoked_at IS NULL;
REVOKE ALL ON TABLE control.nullable_root_backfill_assignments FROM PUBLIC;

CREATE TABLE control.backfill_audit_ledger (
    id uuid PRIMARY KEY,
    operation_id uuid NOT NULL,
    attempt integer NOT NULL CHECK (attempt > 0),
    phase text NOT NULL CHECK (phase IN ('STARTED', 'SUCCEEDED', 'FAILED', 'ROLLBACK')),
    organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    correlation_id text NOT NULL,
    manifest_digest text NOT NULL CHECK (length(manifest_digest) = 64),
    decision text NOT NULL CHECK (decision IN ('ALLOW', 'DENY', 'OBSERVED')),
    reason_code text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (operation_id, attempt, phase)
);
REVOKE ALL ON TABLE control.backfill_audit_ledger FROM PUBLIC;

CREATE OR REPLACE FUNCTION control.apply_member_backfill_assignment(requested_record_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, security, control
AS $$
DECLARE assigned_organization_id text;
BEGIN
    SELECT assignment.organization_id INTO assigned_organization_id
    FROM control.nullable_root_backfill_assignments AS assignment
    JOIN security.role_to_organization AS mapping
      ON mapping.organization_id = assignment.organization_id
     AND mapping.role_oid = (session_user::regrole)::oid
     AND mapping.revoked_at IS NULL
    WHERE assignment.root_table = 'members'
      AND assignment.record_id = requested_record_id
      AND assignment.revoked_at IS NULL;
    IF assigned_organization_id IS NULL THEN RETURN false; END IF;
    UPDATE public.members
       SET "organizationId" = assigned_organization_id
     WHERE id = requested_record_id
       AND "organizationId" IS NULL;
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION control.apply_kpi_backfill_assignment(requested_record_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, security, control
AS $$
DECLARE assigned_organization_id text;
DECLARE root_updated boolean;
BEGIN
    SELECT assignment.organization_id INTO assigned_organization_id
    FROM control.nullable_root_backfill_assignments AS assignment
    JOIN security.role_to_organization AS mapping
      ON mapping.organization_id = assignment.organization_id
     AND mapping.role_oid = (session_user::regrole)::oid
     AND mapping.revoked_at IS NULL
    WHERE assignment.root_table = 'kpis'
      AND assignment.record_id = requested_record_id
      AND assignment.revoked_at IS NULL;
    IF assigned_organization_id IS NULL THEN RETURN false; END IF;
    UPDATE public.kpis
       SET "organizationId" = assigned_organization_id
     WHERE id = requested_record_id
       AND "organizationId" IS NULL;
    root_updated := FOUND;
    IF NOT root_updated THEN RETURN false; END IF;
    UPDATE public.kpi_records
       SET "organizationId" = assigned_organization_id
     WHERE "kpiId" = requested_record_id
       AND "organizationId" IS NULL;
    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION control.apply_member_backfill_assignment(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION control.apply_kpi_backfill_assignment(text) FROM PUBLIC;
