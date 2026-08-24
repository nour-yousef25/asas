#!/usr/bin/env bash
# ASAS-only retention. Default mode is dry-run; deletion requires --apply.
set -euo pipefail

root=/opt/asasplus/backups
retention_days=30
mode=dry-run
[[ "${1:-}" = "--apply" ]] && mode=apply
[[ -z "${1:-}" || "${1:-}" = "--apply" ]] || { echo "usage: $0 [--apply]" >&2; exit 2; }

find "$root" -mindepth 1 -maxdepth 1 -type d -name '*-production-backup' -mtime "+$retention_days" -print0 |
while IFS= read -r -d '' candidate; do
  manifest="$candidate/production-backup-manifest.json"
  evidence="$candidate/production-backup-restore-evidence.json"
  [[ -f "$manifest" && -f "$evidence" ]] || continue
  grep -q '"status":"PASS_PRODUCTION_BACKUP_RESTORE_REHEARSAL"' "$evidence" || continue
  if [[ "$mode" = apply ]]; then
    rm -rf -- "$candidate"
    printf 'retention=deleted path=%s\n' "$candidate"
  else
    printf 'retention=candidate path=%s\n' "$candidate"
  fi
done
printf 'PRODUCTION_BACKUP_RETENTION=%s days=%s\n' "$mode" "$retention_days"
