# ADR-W02-012 — Tenant-Bound Nullable-Root Apply

## Status

**ACCEPTED FOR AUDIT REHEARSAL ONLY.** This successor completes ADR-W02-010: the control-plane ledger records operations, but never applies tenant data mutations.

## Problem

An immutable control-plane ledger solves the multi-organization audit boundary but deliberately has no tenant data privilege. A global control-plane mutator would violate that boundary. Existing nullable roots cannot be applied by a tenant principal safely merely because its role has table update privilege: a tenant could otherwise claim any unowned record by ID.

## Decision

Backfill application is tenant-bound **per organization** and uses an operational tenant connection whose PostgreSQL `session_user` is the tenant login principal. It is distinct from an end-user request and therefore does not invent a user membership, a first membership fallback, or a default tenant. Its authority is bound to an explicit manifest digest and a protected control-plane assignment table.

| actor | privileges | prohibited capabilities |
|---|---|---|
| Ledger writer | append only to `control.backfill_audit_ledger` | tenant data and `audit_logs` read/write; update/delete ledger |
| Assignment authority | create/revoke explicit mapping rows only | tenant roots/children and ledger outcomes |
| Tenant backfill principal | column-only owner application for matching assignment and parent graph | arbitrary row claim, cross-org write, audit ledger write, raw GUC identity |
| Security mapping reader | read `session_user` role OID and protected assignment/map state | tenant-supplied identity, dynamic SQL, mutation |

The admission rule is database-enforced with an immutable explicit assignment keyed by table/root record, organization, and manifest digest. Fixed, hardened `SECURITY DEFINER` procedures read **`session_user`** internally and perform only `NULL → assignment.organization_id` updates for `Member` or `KPI → KPIRecord` graph. Their owner must be a non-login, non-superuser, `NOBYPASSRLS` security owner; their search paths are fixed; `PUBLIC` execute is revoked; tenant callers receive procedure execute only and no root-table privileges. The procedures never accept client organization, raw GUC, membership inference, arbitrary table names, SQL fragments, or payloads. Missing/revoked/duplicate assignment returns false and writes nothing.

## Transaction and audit sequence

1. Ledger writer appends `STARTED` metadata before an organization apply.
2. Assignment authority creates explicit assignments from a validated manifest digest.
3. Tenant-bound provider validates `session_user`, then applies only admitted rows in a local transaction.
4. Ledger writer appends `SUCCEEDED`, `FAILED`, or `ROLLBACK`; no outcome update occurs.
5. Duplicate/replay is rejected by operation/attempt/phase uniqueness; incomplete `STARTED` is recovery-visible.

Failure to obtain a tenant provider, assignment, verifier result, transaction, ledger event, or cleanup fails closed. Operational provider/retention/DR/HA remains production readiness work and is not implemented by this ADR.

## Consequences

This is not Financial RLS: it is a narrow, auditable admission boundary for setting legacy nullable owners. It must receive a clean/upgrade PostgreSQL rehearsal with A/B, direct ID, assignment forgery, replay, transaction failure, retry, resume, rollback, concurrency, cleanup, and exact evidence before any dashboard cutover or RLS wave.
