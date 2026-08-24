#!/usr/bin/env bash
# Creates ASAS production foundation on the target VPS only. It never edits DNS or an OpenLiteSpeed vhost.
set -euo pipefail

root=/opt/asasplus
release="$root/releases/20260824T202100Z-b527499"
current="$root/production-current"
shared="$root/shared"
database=asasplus_production
migrator_role=asasplus_production_migrator
migrator_login=asasplus_production_migrator_login
control_role=asasplus_production_control
control_login=asasplus_production_control_login
redis_port=6386
runtime_secrets="$shared/production-runtime-secrets.conf"
migration_secrets="$shared/production-migration-secrets.conf"
redis_config="$shared/production-redis.conf"
web_unit=/etc/systemd/system/asasplus-web-production.service
worker_unit=/etc/systemd/system/asasplus-worker-production.service
redis_unit=/etc/systemd/system/asasplus-redis-production.service
rollback_log="$root/backups/$(date -u +%Y%m%dT%H%M%SZ)-production-foundation-bootstrap"
created=false
stage=preflight

mark_stage() {
  stage="$1"
  printf 'PRODUCTION_FOUNDATION_STAGE=%s\n' "$stage" >&2
}

fail_cleanup() {
  status=$?
  if [[ "$created" = true ]]; then
    systemctl disable --now asasplus-web-production.service asasplus-worker-production.service asasplus-redis-production.service >/dev/null 2>&1 || true
    rm -f "$web_unit" "$worker_unit" "$redis_unit" "$current" "$runtime_secrets" "$migration_secrets" "$redis_config" "$shared/production-backup-encryption.key"
    rm -rf "$shared/production-tenant-credentials" "$shared/production-queue-credentials" "$shared/production-redis-data"
    sudo -u postgres dropdb --if-exists "$database" >/dev/null 2>&1 || true
    sudo -u postgres psql -X -d postgres -v ON_ERROR_STOP=1 <<SQL >/dev/null 2>&1 || true
DROP ROLE IF EXISTS $control_login;
DROP ROLE IF EXISTS $control_role;
DROP ROLE IF EXISTS $migrator_login;
DROP ROLE IF EXISTS $migrator_role;
SQL
    systemctl daemon-reload >/dev/null 2>&1 || true
  fi
  exit "$status"
}
trap fail_cleanup ERR

test "$(id -u)" = 0
mark_stage preflight_release
test -d "$release"
test ! -e "$current"
test ! -e "$runtime_secrets"
test ! -e "$migration_secrets"
test ! -e "$redis_config"
mark_stage preflight_database
sudo -u postgres psql -X -At -d postgres -c "SELECT count(*) FROM pg_database WHERE datname = '$database';" | grep -qx 0
sudo -u postgres psql -X -At -d postgres -c "SELECT count(*) FROM pg_roles WHERE rolname IN ('$migrator_role','$migrator_login','$control_role','$control_login');" | grep -qx 0
mark_stage preflight_services
systemctl is-active --quiet postgresql.service
test ! -e "$web_unit" && test ! -e "$worker_unit" && test ! -e "$redis_unit"

mark_stage filesystem
install -d -o root -g asasplus -m 2750 "$shared/production-tenant-credentials" "$shared/production-queue-credentials"
install -d -o asasplus -g asasplus -m 0750 "$shared/production-redis-data"
install -d -o root -g postgres -m 0710 "$rollback_log"
created=true

db_migrator_password=$(openssl rand -hex 32)
db_control_password=$(openssl rand -hex 32)
redis_password=$(openssl rand -hex 32)
health_token=$(openssl rand -hex 32)
auth_secret=$(openssl rand -hex 32)
integrations_key=$(openssl rand -hex 32)

mark_stage postgres_roles_database
sudo -u postgres psql -X -d postgres -v ON_ERROR_STOP=1 <<SQL
CREATE ROLE $migrator_role NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE $control_role NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE $migrator_login LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS PASSWORD '$db_migrator_password';
CREATE ROLE $control_login LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS PASSWORD '$db_control_password';
GRANT $migrator_role TO $migrator_login;
GRANT $control_role TO $control_login;
CREATE DATABASE $database OWNER $migrator_login;
REVOKE ALL ON DATABASE $database FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE $database TO $migrator_role, $migrator_login, $control_role, $control_login;
SQL

umask 077
cat > "$migration_secrets" <<EOF
DATABASE_URL=postgresql://$migrator_login:$db_migrator_password@127.0.0.1:5432/$database?schema=public
EOF
cat > "$runtime_secrets" <<EOF
NODE_ENV=production
ASAS_EDITION=DEDICATED
ASAS_INSTANCE_ROLE=APP
ASAS_RELEASE_CHANNEL=STABLE
ASAS_RELEASE_VERSION=20260824T202100Z-b527499
ASAS_PUBLIC_URL=https://asasplus.shop
NEXT_PUBLIC_APP_URL=https://asasplus.shop
DATABASE_URL=postgresql://$control_login:$db_control_password@127.0.0.1:5432/$database?schema=public
REDIS_URL=redis://:$redis_password@127.0.0.1:$redis_port/0
ASAS_HEALTH_TOKEN=$health_token
AUTH_SECRET=$auth_secret
INTEGRATIONS_ENCRYPTION_KEY=$integrations_key
TENANT_CREDENTIAL_DIRECTORY=$shared/production-tenant-credentials
TENANT_QUEUE_CREDENTIAL_DIRECTORY=$shared/production-queue-credentials
EOF
openssl rand -hex 32 > "$shared/production-backup-encryption.key"
chown root:root "$migration_secrets" "$runtime_secrets" "$shared/production-backup-encryption.key"
chmod 0600 "$migration_secrets" "$runtime_secrets" "$shared/production-backup-encryption.key"

cat > "$redis_config" <<EOF
bind 127.0.0.1 ::1
port $redis_port
protected-mode yes
dir $shared/production-redis-data
appendonly yes
appendfsync everysec
save 900 1
save 300 10
save 60 10000
logfile ""
requirepass $redis_password
EOF
chown root:asasplus "$redis_config"
chmod 0640 "$redis_config"

mark_stage production_link_and_units
ln -s "$release" "$current"
cat > "$redis_unit" <<EOF
[Unit]
Description=ASAS Plus isolated Redis production (loopback only)
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=asasplus
Group=asasplus
RuntimeDirectory=asasplus-redis-production
RuntimeDirectoryMode=0750
UMask=0077
ExecStart=/usr/bin/redis-server $redis_config
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=$shared/production-redis-data
LimitNOFILE=65536
[Install]
WantedBy=multi-user.target
EOF
cat > "$web_unit" <<EOF
[Unit]
Description=ASAS Plus Next.js production web (loopback pre-cutover)
After=network-online.target asasplus-redis-production.service postgresql.service
Wants=network-online.target
[Service]
Type=simple
User=asasplus
Group=asasplus
WorkingDirectory=$current/.next/standalone
EnvironmentFile=$runtime_secrets
Environment=PORT=3106
Environment=HOSTNAME=127.0.0.1
Environment=ASAS_INSTANCE_ROLE=APP
Environment=TENANT_CREDENTIAL_ALLOWED_GROUP_ID=$(getent group asasplus | awk -F: '{print $3}')
UMask=0077
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadOnlyPaths=$current
ReadWritePaths=$shared
MemoryMax=768M
LimitNOFILE=65536
[Install]
WantedBy=multi-user.target
EOF
cat > "$worker_unit" <<EOF
[Unit]
Description=ASAS Plus tenant publication worker production (loopback pre-cutover)
After=network-online.target asasplus-redis-production.service postgresql.service
Wants=network-online.target
[Service]
Type=simple
User=asasplus
Group=asasplus
WorkingDirectory=$current
EnvironmentFile=$runtime_secrets
Environment=ASAS_INSTANCE_ROLE=WORKER
Environment=TENANT_CREDENTIAL_ALLOWED_GROUP_ID=$(getent group asasplus | awk -F: '{print $3}')
Environment=TENANT_QUEUE_CREDENTIAL_ALLOWED_GROUP_ID=$(getent group asasplus | awk -F: '{print $3}')
UMask=0077
ExecStart=/usr/bin/pnpm exec tsx src/workers/tenant-publication-supervisor.ts
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadOnlyPaths=$current
ReadWritePaths=$shared
MemoryMax=512M
LimitNOFILE=65536
[Install]
WantedBy=multi-user.target
EOF
chmod 0644 "$redis_unit" "$web_unit" "$worker_unit"
systemctl daemon-reload
mark_stage redis_start
systemctl enable --now asasplus-redis-production.service

mark_stage migrations
set -a
. "$migration_secrets"
set +a
sudo -u asasplus env DATABASE_URL="$DATABASE_URL" bash -lc "set -euo pipefail; cd '$current'; pnpm exec prisma migrate deploy"

sudo -u postgres psql -X -d "$database" -v ON_ERROR_STOP=1 <<SQL
GRANT USAGE ON SCHEMA public TO $control_role;
GRANT SELECT ON TABLE users, organization_memberships, tenant_database_principals TO $control_role;
GRANT SELECT, INSERT, UPDATE ON TABLE tenant_access_leases, tenant_broker_audit_events TO $control_role;
SQL

systemctl enable --now asasplus-web-production.service asasplus-worker-production.service
mark_stage service_health
sleep 5
systemctl is-active --quiet asasplus-web-production.service
systemctl is-active --quiet asasplus-worker-production.service
systemctl is-active --quiet asasplus-redis-production.service
printf '%s\n' '{"status":"PASS_PRODUCTION_FOUNDATION_BOOTSTRAP","dnsChanged":false,"publicVhostChanged":false,"productionTrafficEnabled":false,"externalProvidersConfigured":false}' > "$rollback_log/evidence.json"
chmod 0600 "$rollback_log/evidence.json"
trap - ERR
printf 'PRODUCTION_FOUNDATION_BOOTSTRAP=PASS evidence=%s\n' "$rollback_log/evidence.json"
