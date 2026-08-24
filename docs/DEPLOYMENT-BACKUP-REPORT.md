# ASAS Plus — Pre-Change Backup Report

## Scope and Isolation

The pre-change backup is limited to ASAS Plus. It contains only the existing `asasplus.shop` placeholder web root, the ASAS vhost configuration, and the verified Git mirror archive. No Qiyas, Scholines, other website, PostgreSQL, Redis, PM2, or CyberPanel data was read, copied, changed, or included.

| Item | Status | Verification |
|---|---|---|
| `/home/asasplus.shop/public_html` snapshot | PASS | compressed archive listing succeeds |
| ASAS OpenLiteSpeed vhost snapshot | PASS | SHA-256 recorded and verified |
| Verified Git mirror archive | PASS | SHA-256, extraction, `git fsck`, refs/commit/HEAD comparison pass |
| Existing ASAS database | NOT PRESENT IN INVENTORY | no ASAS database discovered; no database backup required before creation |
| Existing ASAS storage data | NOT PRESENT IN INVENTORY | domain root contained placeholder only |

## Backup Location and Access

Backup path: `/opt/asasplus/backups/20260824T175856Z/`. Files are mode `0600` and the directory is restricted. No secret values are included in this report or its checksums.

## Restore Boundary

The current website/vhost can be restored from these ASAS-only artifacts. A future ASAS PostgreSQL backup is required before every database schema or data change, and must be created/restored only against the dedicated ASAS database once provisioned. There is no approved rollback that touches a different project database or website.
