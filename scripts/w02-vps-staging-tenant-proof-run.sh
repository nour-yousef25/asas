#!/usr/bin/env bash
# Staging-only proof orchestrator. This file contains no credential values.
set -euo pipefail

release=/opt/asasplus/staging-current
stamp=$(date -u +%Y%m%dT%H%M%SZ)
suffix="$(date -u +%H%M%S)_$RANDOM"
proof_dir=/opt/asasplus/shared/staging-proof
backup="/opt/asasplus/backups/$stamp"
fixture="$proof_dir/fixture-$suffix.json"
evidence="$proof_dir/evidence-$suffix.json"
final_evidence="$backup/vps-staging-tenant-runtime-evidence.json"
cleanup_report="$backup/vps-staging-tenant-runtime-cleanup.json"

org_a=$(cat /proc/sys/kernel/random/uuid); org_b=$(cat /proc/sys/kernel/random/uuid)
user_a=$(cat /proc/sys/kernel/random/uuid); user_b=$(cat /proc/sys/kernel/random/uuid)
member_a=$(cat /proc/sys/kernel/random/uuid); member_b=$(cat /proc/sys/kernel/random/uuid)
permission=$(cat /proc/sys/kernel/random/uuid); role_a=$(cat /proc/sys/kernel/random/uuid); role_b=$(cat /proc/sys/kernel/random/uuid)
principal_row_a=$(cat /proc/sys/kernel/random/uuid); principal_row_b=$(cat /proc/sys/kernel/random/uuid)
channel_a=$(cat /proc/sys/kernel/random/uuid); channel_b=$(cat /proc/sys/kernel/random/uuid)
content_a=$(cat /proc/sys/kernel/random/uuid); content_b=$(cat /proc/sys/kernel/random/uuid)
variant_a=$(cat /proc/sys/kernel/random/uuid); variant_b=$(cat /proc/sys/kernel/random/uuid)
plan_a=$(cat /proc/sys/kernel/random/uuid); plan_b=$(cat /proc/sys/kernel/random/uuid)
principal_a="asas_stg_a_$suffix"; principal_b="asas_stg_b_$suffix"
redis_user_a="asasq_stg_a_$suffix"; redis_user_b="asasq_stg_b_$suffix"
ref_a="vpsproofa_$suffix"; ref_b="vpsproofb_$suffix"
queue_ref_a="vpsqueuea_$suffix"; queue_ref_b="vpsqueueb_$suffix"
password_a=$(openssl rand -hex 32); password_b=$(openssl rand -hex 32)
redis_password_a=$(openssl rand -hex 32); redis_password_b=$(openssl rand -hex 32)
cleanup_ok=true

run_redis_fixture() {
  local mode="$1"
  sudo -u asasplus env \
    REDIS_URL="$REDIS_URL" \
    ASAS_PROOF_REDIS_MODE="$mode" \
    ASAS_PROOF_REDIS_USER_A="$redis_user_a" \
    ASAS_PROOF_REDIS_USER_B="$redis_user_b" \
    ASAS_PROOF_REDIS_PASSWORD_A="$redis_password_a" \
    ASAS_PROOF_REDIS_PASSWORD_B="$redis_password_b" \
    ASAS_PROOF_ORG_A="$org_a" \
    ASAS_PROOF_ORG_B="$org_b" \
    node "$release/scripts/w02-vps-staging-redis-acl-fixture.mjs"
}

cleanup() {
  local status=$?
  set +e
  systemctl stop asasplus-worker-staging.service >/dev/null 2>&1
  if [[ -n "${REDIS_URL:-}" ]]; then
    run_redis_fixture cleanup >/dev/null 2>&1 || cleanup_ok=false
  else
    cleanup_ok=false
  fi
  sudo -u postgres psql -d asasplus_staging -X -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<SQL || cleanup_ok=false
DELETE FROM "tenant_broker_audit_events" WHERE "organizationId" IN ('$org_a','$org_b');
DELETE FROM "tenant_access_leases" WHERE "organizationId" IN ('$org_a','$org_b');
DELETE FROM security.role_to_organization WHERE organization_id IN ('$org_a','$org_b');
DELETE FROM "organizations" WHERE id IN ('$org_a','$org_b');
DROP ROLE IF EXISTS $principal_a;
DROP ROLE IF EXISTS $principal_b;
SQL
  rm -f "/opt/asasplus/shared/tenant-credentials/${ref_a}.url" "/opt/asasplus/shared/tenant-credentials/${ref_b}.url"
  rm -f "/opt/asasplus/shared/queue-credentials/${queue_ref_a}.url" "/opt/asasplus/shared/queue-credentials/${queue_ref_b}.url"
  rm -f "$fixture"
  if [[ -f "$evidence" ]]; then
    install -m 0600 -o root -g root "$evidence" "$final_evidence"
    setfacl -b "$final_evidence" >/dev/null 2>&1 || cleanup_ok=false
  fi
  rm -f "$evidence"
  systemctl restart asasplus-worker-staging.service >/dev/null 2>&1 || cleanup_ok=false
  systemctl is-active --quiet asasplus-worker-staging.service || cleanup_ok=false
  printf '{"cleanup":"%s","fixtureResidueExpected":false,"credentialsPersisted":false,"productionResourcesTouched":false}\n' "$cleanup_ok" > "$cleanup_report"
  chmod 0600 "$cleanup_report"
  if [[ "$status" -ne 0 || "$cleanup_ok" != true ]]; then
    exit 2
  fi
}
trap cleanup EXIT

install -d -o root -g asasplus -m 2750 "$proof_dir" "$backup"
set -a; . /opt/asasplus/shared/runtime-secrets.conf; set +a
test -n "${REDIS_URL:-}"

# Root-owned mode 0600 files are shared with only the ASAS service account by named ACL.
printf 'postgresql://%s:%s@127.0.0.1:5432/asasplus_staging?schema=public\n' "$principal_a" "$password_a" > "/opt/asasplus/shared/tenant-credentials/${ref_a}.url"
printf 'postgresql://%s:%s@127.0.0.1:5432/asasplus_staging?schema=public\n' "$principal_b" "$password_b" > "/opt/asasplus/shared/tenant-credentials/${ref_b}.url"
printf 'redis://%s:%s@127.0.0.1:6385/0\n' "$redis_user_a" "$redis_password_a" > "/opt/asasplus/shared/queue-credentials/${queue_ref_a}.url"
printf 'redis://%s:%s@127.0.0.1:6385/0\n' "$redis_user_b" "$redis_password_b" > "/opt/asasplus/shared/queue-credentials/${queue_ref_b}.url"
chmod 0600 "/opt/asasplus/shared/tenant-credentials/${ref_a}.url" "/opt/asasplus/shared/tenant-credentials/${ref_b}.url"
chmod 0600 "/opt/asasplus/shared/queue-credentials/${queue_ref_a}.url" "/opt/asasplus/shared/queue-credentials/${queue_ref_b}.url"
chown root:root "/opt/asasplus/shared/tenant-credentials/${ref_a}.url" "/opt/asasplus/shared/tenant-credentials/${ref_b}.url"
chown root:root "/opt/asasplus/shared/queue-credentials/${queue_ref_a}.url" "/opt/asasplus/shared/queue-credentials/${queue_ref_b}.url"
setfacl -m u:asasplus:r-- "/opt/asasplus/shared/tenant-credentials/${ref_a}.url" "/opt/asasplus/shared/tenant-credentials/${ref_b}.url"
setfacl -m u:asasplus:r-- "/opt/asasplus/shared/queue-credentials/${queue_ref_a}.url" "/opt/asasplus/shared/queue-credentials/${queue_ref_b}.url"

run_redis_fixture provision >/dev/null

sudo -u postgres psql -d asasplus_staging -X -v ON_ERROR_STOP=1 >/dev/null <<SQL
CREATE ROLE $principal_a LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '$password_a';
CREATE ROLE $principal_b LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '$password_b';
GRANT CONNECT ON DATABASE asasplus_staging TO $principal_a,$principal_b;
GRANT USAGE ON SCHEMA public TO $principal_a,$principal_b;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE "beneficiaries","organization_memberships","membership_roles","organization_roles","organization_role_permissions","permissions","membership_permission_overrides","publication_plans","channel_variants","communication_content_items","connected_channels","channel_credentials" TO $principal_a,$principal_b;
INSERT INTO "organizations" ("id","name","createdAt","updatedAt") VALUES ('$org_a','VPS Staging Proof A',now(),now()),('$org_b','VPS Staging Proof B',now(),now());
INSERT INTO "users" ("id","name","email","role","isActive","authVersion","activeOrganizationId","createdAt","updatedAt") VALUES ('$user_a','VPS Proof A','a-$suffix@staging.invalid','MEMBER',true,1,'$org_a',now(),now()),('$user_b','VPS Proof B','b-$suffix@staging.invalid','MEMBER',true,1,'$org_b',now(),now());
INSERT INTO "organization_memberships" ("id","organizationId","userId","role","isActive","policyVersion","createdAt","updatedAt") VALUES ('$member_a','$org_a','$user_a','MEMBER',true,1,now(),now()),('$member_b','$org_b','$user_b','MEMBER',true,1,now(),now());
INSERT INTO "permissions" ("id","name","module","action") VALUES ('$permission','communications.publication.schedule','communications','publication.schedule');
INSERT INTO "organization_roles" ("id","organizationId","name","isSystem","createdAt","updatedAt") VALUES ('$role_a','$org_a','VPS_QUEUE_ADMIN_A',true,now(),now()),('$role_b','$org_b','VPS_QUEUE_ADMIN_B',true,now(),now());
INSERT INTO "organization_role_permissions" ("organizationRoleId","permissionId","effect") VALUES ('$role_a','$permission','ALLOW'),('$role_b','$permission','ALLOW');
INSERT INTO "membership_roles" ("membershipId","organizationRoleId","assignedAt") VALUES ('$member_a','$role_a',now()),('$member_b','$role_b',now());
INSERT INTO security.role_to_organization (role_oid,organization_id) VALUES ('$principal_a'::regrole::oid,'$org_a'),('$principal_b'::regrole::oid,'$org_b');
INSERT INTO "tenant_database_principals" ("id","organizationId","principalName","credentialReference","queueCredentialReference","generation","status","activatedAt","createdAt","updatedAt") VALUES ('$principal_row_a','$org_a','$principal_a','file://$ref_a','file://$queue_ref_a',1,'ACTIVE',now(),now(),now()),('$principal_row_b','$org_b','$principal_b','file://$ref_b','file://$queue_ref_b',1,'ACTIVE',now(),now(),now());
INSERT INTO "connected_channels" ("id","organizationId","platform","externalId","displayName","status","scopes","capabilities","createdAt","updatedAt") VALUES ('$channel_a','$org_a','X','proof-a-$suffix','Proof A','CONFIGURATION_REQUIRED',ARRAY[]::text[],'{}'::jsonb,now(),now()),('$channel_b','$org_b','X','proof-b-$suffix','Proof B','CONFIGURATION_REQUIRED',ARRAY[]::text[],'{}'::jsonb,now(),now());
INSERT INTO "communication_content_items" ("id","organizationId","type","title","body","status","tags","assetUrls","createdAt","updatedAt") VALUES ('$content_a','$org_a','INDEPENDENT','A','A','APPROVED',ARRAY[]::text[],ARRAY[]::text[],now(),now()),('$content_b','$org_b','INDEPENDENT','B','B','APPROVED',ARRAY[]::text[],ARRAY[]::text[],now(),now());
INSERT INTO "channel_variants" ("id","contentItemId","connectedChannelId","platform","copy","status","assetUrls","createdAt","updatedAt") VALUES ('$variant_a','$content_a','$channel_a','X','A','APPROVED',ARRAY[]::text[],now(),now()),('$variant_b','$content_b','$channel_b','X','B','APPROVED',ARRAY[]::text[],now(),now());
INSERT INTO "publication_plans" ("id","organizationId","channelVariantId","status","createdAt","updatedAt") VALUES ('$plan_a','$org_a','$variant_a','PUBLISHED',now(),now()),('$plan_b','$org_b','$variant_b','PUBLISHED',now(),now());
SQL

printf '{"organizationA":"%s","organizationB":"%s","userA":"%s","userB":"%s","membershipA":"%s","membershipB":"%s","principalA":"%s","principalB":"%s","planA":"%s","planB":"%s"}\n' "$org_a" "$org_b" "$user_a" "$user_b" "$member_a" "$member_b" "$principal_a" "$principal_b" "$plan_a" "$plan_b" > "$fixture"
chmod 0600 "$fixture"; chown root:root "$fixture"; setfacl -m u:asasplus:r-- "$fixture"
touch "$evidence"; chmod 0600 "$evidence"; chown root:root "$evidence"; setfacl -m u:asasplus:rw- "$evidence"

systemctl restart asasplus-worker-staging.service
sleep 3
systemctl is-active --quiet asasplus-worker-staging.service
journalctl -u asasplus-worker-staging.service --since "90 seconds ago" --no-pager | grep -q "active for 2 provisioned tenant"

sudo -u asasplus bash -lc "set -euo pipefail; set -a; . /opt/asasplus/shared/runtime-secrets.conf; set +a; export ASAS_VPS_STAGING_PROOF_FIXTURE_FILE='$fixture'; export ASAS_VPS_STAGING_PROOF_EVIDENCE_FILE='$evidence'; cd '$release'; pnpm exec tsx scripts/w02-vps-staging-tenant-runtime-proof.ts"
cd "$release"
node scripts/w02-vps-staging-tenant-runtime-proof-validate.mjs "$evidence"
printf 'VPS_TENANT_AB_PROOF=PASS evidence=%s cleanup_report=%s\n' "$final_evidence" "$cleanup_report"
