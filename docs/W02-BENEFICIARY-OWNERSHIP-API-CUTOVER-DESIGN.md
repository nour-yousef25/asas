# W02 Beneficiary Ownership and API Runtime Cutover — Design

## Scope

This scope closes the remaining direct Prisma dashboard reads for the Beneficiary root family and proves the existing repository boundary against a PostgreSQL audit database. It does not convert BeneficiaryDocument object delivery: raw file URLs are no longer rendered on the dashboard; private delivery remains a Storage/Documents scope prerequisite.

## Contract

Every converted Beneficiary read begins with server-side `requireTenantContext()` and `beneficiary.read` policy enforcement. The repository receives the resolved context, places `organizationId` inside every list/get/mutation predicate, derives create ownership from context, and emits a redacted tenant-scope denial audit event for inaccessible read/update/delete attempts. Request input cannot choose a different owner.

## Runtime Evidence

The proof uses an actual non-owner PostgreSQL application role over a clean migrated audit database. It seeds two organizations, two active memberships, and two Beneficiary records. O01–O06 prove A-scoped listing, cross-tenant read/update/delete denial, forged organization create refusal, and correlation-bound denial audit output. The evidence validator rejects incomplete coverage, duplicate or invalid IDs, evidence/cleanup failures, credential persistence, production touch, and hard failures.

## Exclusions

No RLS policy is enabled by this scope. The user-facing Documents payload can be listed only through the scoped parent lookup; it cannot be downloaded from this dashboard until the private storage delivery scope exists. RLS Wave 1 may start only with its own migration/rehearsal and direct PostgreSQL proof.
