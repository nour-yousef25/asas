# W02 RLS Hybrid Tenant-Bound Identity Proof — Baseline Audit

## Scope and Baseline

| Item | Evidence | Result |
|---|---|---|
| Legal branch | `w02-rls-hybrid-identity-proof` | clean at audit start |
| Canonical baseline | `ffad6c187f495ee69453592ccd62f5acbbdba6e0` | created from `w02-continuous-tenant-safety` |
| Protected worktrees | `w02-wp5`, `w02-wp4-backfill-contract-fix`, `w02-continuous-tenant-safety` | not modified or merged |
| Required W02 references | ADR-001/002, Alternative Architecture Decision/Final/Matrices, Dependency Map, RLS blocker, WP5-0/1/2/3 documents | present |
| Active source RLS implementation | scan for policy/RLS/GUC primitives under `prisma` and `src` | no active RLS implementation found |

## Local PostgreSQL Read-Only Posture

The audit inspected the local `postgres` maintenance database only. PostgreSQL version is **16.15**. The database contains only `plpgsql` as installed extension, a public schema, no RLS-protected tables, and no security-definer functions in that maintenance database.

The local server retains prior disposable audit roles and databases, including previous raw-GUC Wave 1 audit artifacts. They are historical evidence only and are not a source for this proof. No Production endpoint, credential, secret, Vault, Redis, Storage, or deployment was read or changed.

## Role and Privilege Observations

The local cluster has the bootstrap `postgres` superuser plus historical local audit login roles. The prior disposable app roles report `NOBYPASSRLS`, but their existence does not establish a safe runtime contract. No tenant A/B login principals, tenant role mapping, tenant broker, or security schema exist in the baseline.

## Current Security Blockers

| Blocker | Status | Impact on this proof |
|---|---|---|
| Raw GUC identity | rejected by direct A→B test | forbidden; must have no effect in proof |
| Asymmetric verifier adapter | unavailable across support modes | not used |
| Tenant-bound login/broker contract | proposed only | must be designed and proven in audit environment |
| RLS family prerequisites | partial | proof must not claim RLS Wave 1 readiness without all gates |
| Existing prior audit roles/databases | local disposable artifacts | must not be reused as proof environment |

## Files Inspected

`ADR-W02-001-TENANT-CANONICAL.md`, `ADR-W02-002-RLS-STRATEGY.md`, `W02-RLS-ALTERNATIVE-ARCHITECTURE-DECISION.md`, `W02-RLS-ALTERNATIVE-ARCHITECTURE-FINAL-REPORT.md`, `W02-RLS-ALTERNATIVE-ARCHITECTURE-MATRICES.md`, `W02-DEPENDENCY-MAP.md`, `W02-RLS-DATABASE-BLOCKER.md`, `W02-WP5-0-CURRENT-SCOPE-INVENTORY.md`, `W02-WP5-1-TENANT-CONTEXT-CONTRACT.md`, `W02-WP5-2-REPOSITORY-API-CUTOVER-DESIGN.md`, and `W02-WP5-3-REPORT-GENERATION-FINAL-REPORT.md`.

## Evidence Reference

The non-sensitive command output is retained at `/tmp/w02-rls-hybrid-phase0-audit.txt` for this sandbox session. It contains no URLs, passwords, connection strings, role passwords, or production information.
