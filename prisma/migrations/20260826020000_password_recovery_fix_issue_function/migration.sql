-- Fix PL/pgSQL output-column ambiguity in the already-applied password recovery issuer.
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
  UPDATE control.password_recovery_tokens AS recovery_token
  SET revoked_at = clock_timestamp()
  WHERE recovery_token.user_id = target_user.id AND recovery_token.consumed_at IS NULL AND recovery_token.revoked_at IS NULL;
  INSERT INTO control.password_recovery_tokens(id, user_id, token_hash, expires_at)
  VALUES (requested_recovery_id, target_user.id, requested_token_hash, requested_expires_at);
  RETURN QUERY SELECT target_user.id, target_user.email, requested_recovery_id;
END;
$$;

REVOKE ALL ON FUNCTION control.issue_password_recovery(text, text, text, timestamptz) FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['asasplus_control', 'asasplus_production_control'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA control TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION control.issue_password_recovery(text, text, text, timestamptz) TO %I', role_name);
    END IF;
  END LOOP;
END;
$$;
