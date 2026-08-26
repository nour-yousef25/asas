-- Password Recovery: opaque hashed reset material only. No raw token, OTP or password is persisted.
CREATE TABLE control.password_recovery_tokens (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (length(token_hash) BETWEEN 40 AND 128),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX password_recovery_tokens_user_active_idx ON control.password_recovery_tokens(user_id, expires_at) WHERE consumed_at IS NULL AND revoked_at IS NULL;
REVOKE ALL ON TABLE control.password_recovery_tokens FROM PUBLIC;

CREATE OR REPLACE FUNCTION control.issue_password_recovery(requested_email text, requested_token_hash text, requested_recovery_id text, requested_expires_at timestamptz)
RETURNS TABLE(user_id text, recipient_email text, recovery_id text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, control
AS $$
DECLARE target_user public.users%ROWTYPE;
BEGIN
  IF requested_email IS NULL OR length(requested_email) > 320 OR requested_token_hash IS NULL OR length(requested_token_hash) NOT BETWEEN 40 AND 128 OR requested_recovery_id !~ '^pr_[a-f0-9]{36}$' OR requested_expires_at <= clock_timestamp() OR requested_expires_at > clock_timestamp() + interval '30 minutes' THEN RETURN; END IF;
  SELECT * INTO target_user FROM public.users WHERE lower(email) = lower(trim(requested_email)) AND "isActive" = true LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE control.password_recovery_tokens SET revoked_at = clock_timestamp() WHERE user_id = target_user.id AND consumed_at IS NULL AND revoked_at IS NULL;
  INSERT INTO control.password_recovery_tokens(id, user_id, token_hash, expires_at) VALUES (requested_recovery_id, target_user.id, requested_token_hash, requested_expires_at);
  RETURN QUERY SELECT target_user.id, target_user.email, requested_recovery_id;
END;
$$;

CREATE OR REPLACE FUNCTION control.consume_password_recovery(requested_token_hash text, requested_password_hash text)
RETURNS TABLE(user_id text, auth_version integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, control
AS $$
DECLARE token_record control.password_recovery_tokens%ROWTYPE;
DECLARE next_version integer;
BEGIN
  IF requested_token_hash IS NULL OR length(requested_token_hash) NOT BETWEEN 40 AND 128 OR requested_password_hash IS NULL OR requested_password_hash !~ '^\$2[aby]\$[0-9]{2}\$' THEN RETURN; END IF;
  SELECT * INTO token_record FROM control.password_recovery_tokens WHERE token_hash = requested_token_hash AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > clock_timestamp() FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.users SET password = requested_password_hash, "authVersion" = "authVersion" + 1 WHERE id = token_record.user_id AND "isActive" = true RETURNING "authVersion" INTO next_version;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE control.password_recovery_tokens SET consumed_at = clock_timestamp() WHERE id = token_record.id;
  RETURN QUERY SELECT token_record.user_id, next_version;
END;
$$;

CREATE OR REPLACE FUNCTION control.record_password_recovery_audit(requested_action text, requested_outcome text, requested_user_fingerprint text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, control
AS $$
BEGIN
  IF requested_action NOT IN ('PASSWORD_RECOVERY_REQUESTED', 'PASSWORD_RECOVERY_RESET', 'PASSWORD_RECOVERY_DELIVERY_FAILED') OR requested_outcome NOT IN ('ISSUED', 'RESET', 'FAILED') OR (requested_user_fingerprint IS NOT NULL AND requested_user_fingerprint !~ '^[A-Za-z0-9_-]{32,128}$') THEN
    RAISE EXCEPTION 'password recovery audit input denied';
  END IF;
  INSERT INTO public.audit_logs(action, entity, details)
  VALUES (requested_action, 'PASSWORD_RECOVERY', jsonb_build_object('schema', 'PASSWORD_RECOVERY_AUDIT_V1', 'outcome', requested_outcome, 'userFingerprint', requested_user_fingerprint));
END;
$$;

REVOKE ALL ON FUNCTION control.issue_password_recovery(text, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION control.consume_password_recovery(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION control.record_password_recovery_audit(text, text, text) FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['asasplus_control', 'asasplus_production_control'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA control TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION control.issue_password_recovery(text, text, text, timestamptz) TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION control.consume_password_recovery(text, text) TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION control.record_password_recovery_audit(text, text, text) TO %I', role_name);
    END IF;
  END LOOP;
END;
$$;
