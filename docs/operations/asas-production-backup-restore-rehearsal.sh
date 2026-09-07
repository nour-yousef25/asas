#!/usr/bin/env bash
# Production database only; does not alter DNS, traffic, unrelated databases, or external storage.
set -euo pipefail

database=asasplus_production
restore_database=asasplus_production_restore_rehearsal
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/opt/asasplus/backups/$stamp-production-backup"
shared=/opt/asasplus/shared
key="$shared/production-backup-encryption.key"
work="$backup/work"
manifest="$backup/production-backup-manifest.json"
evidence="$backup/production-backup-restore-evidence.json"
encrypted="$backup/asasplus_production_backup.tar.enc"

cleanup() {
  set +e
  sudo -u postgres dropdb --if-exists "$restore_database" >/dev/null 2>&1
  setfacl -x u:postgres "$backup" >/dev/null 2>&1
  rm -rf "$work"
}
trap cleanup EXIT

test -f "$key"
test "$(stat -c '%a:%U:%G' "$key")" = "600:root:root"
sudo -u postgres psql -X -At -d postgres -c "SELECT count(*) FROM pg_database WHERE datname = '$restore_database';" | grep -qx 0
install -d -o root -g root -m 0700 "$backup"
install -d -o root -g postgres -m 0750 "$work"

sudo -u postgres pg_dump --format=custom --no-owner --no-privileges "$database" > "$work/asasplus_production.dump"
chown root:postgres "$work/asasplus_production.dump"
chmod 0640 "$work/asasplus_production.dump"
install -d -m 0700 "$work/config"
cp -p /etc/systemd/system/asasplus-web-production.service "$work/config/"
cp -p /etc/systemd/system/asasplus-worker-production.service "$work/config/"
cp -p /etc/systemd/system/asasplus-redis-production.service "$work/config/"
tar -C "$work" -cf "$work/asasplus_production_backup.tar" asasplus_production.dump config
openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:$key" -in "$work/asasplus_production_backup.tar" -out "$encrypted"
chmod 0600 "$encrypted"
checksum=$(sha256sum "$encrypted" | awk '{print $1}')

openssl enc -d -aes-256-cbc -pbkdf2 -pass "file:$key" -in "$encrypted" -out "$work/rehearsal.tar"
install -d -o root -g postgres -m 0750 "$work/rehearsal"
tar -C "$work/rehearsal" -xf "$work/rehearsal.tar"
chown -R root:postgres "$work/rehearsal"
chmod -R g+rX "$work/rehearsal"
setfacl -m u:postgres:--x "$backup"
sudo -u postgres createdb "$restore_database"
sudo -u postgres pg_restore --exit-on-error --no-owner --no-privileges -d "$restore_database" "$work/rehearsal/asasplus_production.dump"
source_tables=$(sudo -u postgres psql -d "$database" -X -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
restored_tables=$(sudo -u postgres psql -d "$restore_database" -X -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
source_migrations=$(sudo -u postgres psql -d "$database" -X -At -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM "_prisma_migrations";')
restored_migrations=$(sudo -u postgres psql -d "$restore_database" -X -At -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM "_prisma_migrations";')
test "$source_tables" = "$restored_tables"
test "$source_migrations" = "$restored_migrations"
sudo -u postgres dropdb "$restore_database"

created_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
backup_id=$(cat /proc/sys/kernel/random/uuid)
cat > "$manifest" <<JSON
{"schemaVersion":1,"backupId":"$backup_id","createdAt":"$created_at","verifiedAt":"$created_at","edition":"DEDICATED","owner":"SHARED","location":"$encrypted","checksum":"sha256:$checksum","encryption":{"enabled":true,"owner":"SHARED"},"contents":{"database":true,"storage":false,"configuration":true}}
JSON
chmod 0640 "$manifest"; chown root:asasplus "$manifest"
setfacl -m u:asasplus:--x /opt/asasplus/backups
setfacl -m u:asasplus:--x "$backup"
cat > "$evidence" <<JSON
{"status":"PASS_PRODUCTION_BACKUP_RESTORE_REHEARSAL","database":"asasplus_production","restoreDatabaseRetained":false,"tableCountMatched":true,"migrationCountMatched":true,"encrypted":true,"storageIncluded":false,"credentialsPersistedInEvidence":false,"dnsChanged":false,"productionTrafficEnabled":false,"unrelatedProductionResourcesTouched":false}
JSON
chmod 0600 "$evidence"
printf 'PRODUCTION_BACKUP_RESTORE=PASS manifest=%s evidence=%s\n' "$manifest" "$evidence"
