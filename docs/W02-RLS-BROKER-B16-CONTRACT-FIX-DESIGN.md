# W02 RLS Broker B16 Contract Fix — Design

## Scope

This fix adds one audit fixture only: an active membership that belongs to **user A** and **organization B**. The B16 request preserves the required input tuple:

| Field | Value class |
|---|---|
| userId | A |
| organizationId | A |
| membershipId | existing membership of A in B |
| Expected | `DENY:MEMBERSHIP_ORGANIZATION_MISMATCH` |

The prior fixture used membership B belonging to user B. The authority query therefore correctly found no membership for user A and returned `MEMBERSHIP_ABSENT`, but it did not reach the intended organization-mismatch branch. The new fixture reaches that branch without changing its expected reason or reducing any validation.

## Boundaries

This change is audit-only. It creates no production membership, role, schema migration, extension, package, credential, or environment change. `W02_B16_ONLY=1` runs only B16 on a new disposable PostgreSQL database; it neither runs B17 onward nor declares the full Broker proof complete.

## Acceptance

The run passes only if no lease is issued and B16 actual evidence equals `DENY:MEMBERSHIP_ORGANIZATION_MISMATCH`. Any other result stops the work package.
