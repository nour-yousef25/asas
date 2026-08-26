-- Password recovery is platform control-plane state; public.audit_logs has tenant RLS FORCE enabled.
-- Keep recovery audit redacted and independent of tenant context without bypassing that RLS contract.
CREATE TABLE control.password_recovery_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action text NOT NULL CHECK (action IN ('PASSWORD_RECOVERY_REQUESTED', 'PASSWORD_RECOVERY_RESET', 'PASSWORD_RECOVERY_DELIVERY_FAILED')),
  outcome text NOT NULL CHECK (outcome IN ('ISSUED', 'RESET', 'FAILED')),
  user_fingerprint text CHECK (user_fingerprint IS NULL OR user_fingerprint ~ '^[A-Za-z0-9_-]{32,128}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX password_recovery_audit_events_created_idx ON control.password_recovery_audit_events(created_at DESC);
REVOKE ALL ON TABLE control.password_recovery_audit_events FROM PUBLIC;

CREATE OR REPLACE FUNCTION control.record_password_recovery_audit(requested_action text, requested_outcome text, requested_user_fingerprint text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, control
AS $$
BEGIN
  IF requested_action NOT IN ('PASSWORD_RECOVERY_REQUESTED', 'PASSWORD_RECOVERY_RESET', 'PASSWORD_RECOVERY_DELIVERY_FAILED') OR requested_outcome NOT IN ('ISSUED', 'RESET', 'FAILED') OR (requested_user_fingerprint IS NOT NULL AND requested_user_fingerprint !~ '^[A-Za-z0-9_-]{32,128}$') THEN
    RAISE EXCEPTION 'password recovery audit input denied';
  END IF;
  INSERT INTO control.password_recovery_audit_events(action, outcome, user_fingerprint)
  VALUES (requested_action, requested_outcome, requested_user_fingerprint);
END;
$$;

REVOKE ALL ON FUNCTION control.record_password_recovery_audit(text, text, text) FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['asasplus_control', 'asasplus_production_control'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA control TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION control.record_password_recovery_audit(text, text, text) TO %I', role_name);
    END IF;
  END LOOP;
END;
$$;
