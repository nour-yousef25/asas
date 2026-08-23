# ADR-W02-010 — Control-Plane Immutable Backfill Audit

## Status

**ACCEPTED FOR AUDIT PROOF ONLY.** The design becomes eligible for nullable-root backfill only after the mandatory local PostgreSQL proof and exact evidence validation pass.

## Context

Tenant `audit_logs` is correctly protected by `FORCE ROW LEVEL SECURITY` under ADR-W02-009. A multi-organization legacy backfill cannot write per-organization audit rows from one control-plane session without either violating the tenant identity boundary or using a prohibited bypass. [1]

## Decision

Create a separate, append-only **control-plane backfill audit ledger**. Its writer authority is not a tenant identity and has no permission on tenant data-plane tables or tenant `audit_logs`. Tenant roles have no ledger privileges. Ledger rows hold operational metadata only: operation UUID, attempt, organization reference, manifest digest, correlation ID, phase, decision/outcome, reason code, and timestamps. They contain no tenant data payload, credentials, connection URLs, or raw mappings.

The ledger is not an RLS identity carrier, is not a tenant event stream, and may not be read by generic tenant routes. It records that a control-plane operation was attempted, failed, or completed; tenant-scoped domain audit remains in `audit_logs` and stays subject to tenant `session_user` policies.

## Integrity and authorization

The control writer receives `INSERT` only on the ledger. It receives no `UPDATE`, `DELETE`, `TRUNCATE`, schema creation, role management, tenant-root, child-table, or tenant-audit privilege. Tenant roles receive no ledger grants. Idempotency is enforced by a unique operation/attempt/phase identity; a duplicate outcome is rejected. An operation is successful only when a committed `SUCCEEDED` event exists. A standalone `STARTED` event is an observable partial/recovery condition, never a success.

## Failure, rollback, and operations

The ledger does not participate in a claim that tenant mutation succeeded. A failed tenant transaction must not produce a success outcome. If an event write fails, the backfill must fail closed before data mutation. If a data transaction fails after a durable `STARTED`, a `FAILED` outcome is required when possible; otherwise recovery detects the unresolved attempt and requires explicit resolution. Rollback is represented as an immutable outcome, not an update or deletion.

The operational owner is the deployment-owned control-plane audit authority. It has its own rotation, retention, backup/restore, HA/DR, and support runbooks. Until those are proven, production activation remains blocked; this ADR authorizes only disposable PostgreSQL proof.

## Consequences

This changes the control-plane/data-plane boundary and therefore does not authorize migration automatically. It removes the need for a global tenant credential or RLS bypass, but introduces a distinct append-only ledger surface that must be proven not forgeable by tenants and unable to mutate tenant data.

[1]: ./ADR-W02-009-TENANT-BOUND-RLS-IDENTITY.md
