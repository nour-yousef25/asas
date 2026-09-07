#!/usr/bin/env bash
# ASAS staging only. Produces an encrypted database/config backup and validates a disposable restore.
set -euo pipefail

database=asasplus_staging
restore_database=asasplus_staging_restore_rehearsal
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/opt/asasplus/backups/$stamp"
shared=/opt/asasplus/shared
key="$shared/staging-backup-encryption.key"
work="$backup/work"
manifest="$backup/staging-backup-manifest.json"
evidence="$backup/staging-backup-restore-evidence.json"
encrypted="$backup/asasplus_staging_backup.tar.enc"

cleanup() {
  set +e
  sudo -u postgres dropdb --if-exists "$restore_database" >/dev/null 2>&1
  setfacl -x u:postgres "$backup" >/dev/null 2>&1
  rm -rf "$work"
}
trap cleanup EXIT

install -d -o root -g root -m 0700 "$backup"
install -d -o root -g postgres -m 0750 "$work"
if [[ ! -f "$key" ]]; then
  umask 077
  openssl rand -hex 32 > "$key"
  chown root:root "$key"
  chmod 0600 "$key"
fi
test "$(stat -c '%a:%U:%G' "$key")" = "600:root:root"

sudo -u postgres pg_dump --format=custom --no-owner --no-privileges "$database" > "$work/asasplus_staging.dump"
chown root:postgres "$work/asasplus_staging.dump"
chmod 0640 "$work/asasplus_staging.dump"
install -d -m 0700 "$work/config"
cp -p /etc/systemd/system/asasplus-web-staging.service "$work/config/"
cp -p /etc/systemd/system/asasplus-worker-staging.service "$work/config/"
tar -C "$work" -cf "$work/asasplus_staging_backup.tar" asasplus_staging.dump config
openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:$key" -in "$work/asasplus_staging_backup.tar" -out "$encrypted"
chmod 0600 "$encrypted"
checksum=$(sha256sum "$encrypted" | awk '{print $1}')

openssl enc -d -aes-256-cbc -pbkdf2 -pass "file:$key" -in "$encrypted" -out "$work/rehearsal.tar"
install -d -o root -g postgres -m 0750 "$work/rehearsal"
tar -C "$work/rehearsal" -xf "$work/rehearsal.tar"
chown -R root:postgres "$work/rehearsal"
chmod -R g+rX "$work/rehearsal"
setfacl -m u:postgres:--x "$backup"
sudo -u postgres createdb "$restore_database"
sudo -u postgres pg_restore --exit-on-error --no-owner --no-privileges -d "$restore_database" "$work/rehearsal/asasplus_staging.dump"
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
cat > "$evidence" <<JSON
{"status":"PASS_VPS_STAGING_BACKUP_RESTORE_REHEARSAL","database":"asasplus_staging","restoreDatabaseRetained":false,"tableCountMatched":true,"migrationCountMatched":true,"encrypted":true,"storageIncluded":false,"credentialsPersistedInEvidence":false,"productionResourcesTouched":false}
JSON
chmod 0600 "$evidence"
printf 'VPS_STAGING_BACKUP_RESTORE=PASS manifest=%s evidence=%s\n' "$manifest" "$evidence"
