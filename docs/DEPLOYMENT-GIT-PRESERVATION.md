# ASAS Plus — Git Preservation Report

## Scope

تم حفظ تاريخ Git قبل نشر VPS أو migration أو إنشاء release runtime. لم يستخدم هذا الإجراء `reset` أو `clean` أو force push أو حذف branch/worktree.

| Check | Result |
|---|---|
| Canonical branch | `w02-global-closure-execution` |
| Preservation baseline HEAD | `7cd4f2079da3e5936ed79addaf4908990fd64e1e` |
| Commit count | 129 |
| Reference count | 35 |
| Tags | 0 |
| Source `git fsck --no-dangling --no-reflogs` | PASS |
| Canonical W02 internal closure retained | PASS; `0056ecd37cfb2cddea6a6d2b1ead09342815963a` remains reachable |

## Preserved Artifacts

The approved artifact is a complete Git mirror archive retained in the ASAS-only VPS backup path:

| Artifact | Location | Verification |
|---|---|---|
| Git mirror archive | `/opt/asasplus/backups/20260824T175856Z/asasplus-mirror.git.tgz` | SHA-256 PASS; extracted temporary restore passed `git fsck`; 129 commits, 35 refs, canonical HEAD exact |
| Public website snapshot | `/opt/asasplus/backups/20260824T175856Z/asasplus-public_html.tgz` | archive listing and SHA-256 PASS |
| ASAS vhost snapshot | `/opt/asasplus/backups/20260824T175856Z/asasplus-vhost.conf` | SHA-256 PASS |

An initial all-refs Git bundle was retained as a historical artifact but **is not designated as the recovery artifact**, because a bare temporary restore showed that it did not contain all required objects. The mirror archive above is the verified recovery source.

## Recovery Procedure

Extract the mirror archive into a controlled directory, verify `git fsck --no-dangling --no-reflogs`, compare the canonical branch HEAD, then clone or create a working tree from `refs/heads/w02-global-closure-execution`. Do not use the non-approved bundle for recovery.
