# W02 RLS Alternative Architecture — Final Report

## Decision

The recommended direction is **Hybrid Tenant-Bound Login Principal**: per-organization PostgreSQL login roles, mapped from immutable `session_user` to `Organization.id`, delivered only through a security-separated Tenant Access Broker. This is the only compared direction that gives PostgreSQL a native tenant identity without trusting raw GUC or an unavailable asymmetric extension.

## Why

`session_user` is normally established by the authenticated database connection; non-superusers cannot change it to another user through `SET SESSION AUTHORIZATION`, and `SET ROLE` requires membership with the SET option.[1] [2] RLS can therefore compare a row’s owner with a secure role-OID mapping, while role A lacks any route to become role B. RLS alone does not defend a central application process that possesses all tenant credentials; separating credential selection into the broker is a prerequisite, not an implicit trust claim.

## Rejected Alternatives

Raw GUC identity, the current `set_config/current_setting` portion of ADR-W02-002, a globally trusted app role, application-only enforcement, HMAC/private key in PostgreSQL, unsupported verifier extensions, custom cryptography, and per-tenant roles **without** credential separation are rejected.

## Evidence Status

| Claim | Status |
|---|---|
| raw GUC allows context switch | PROVEN FAIL in prior PostgreSQL app-role harness |
| role membership/SET ROLE boundary | DOCUMENTED by PostgreSQL official references |
| native per-tenant role design passes A↔B | NOT TESTED — design requirement only |
| broker prevents universal credential misuse | ASSUMPTION pending broker design and real harness |
| Cloud/Dedicated/Self-Hosted support | CONDITIONAL pending provider/operations matrix |

## Remaining Blockers

1. Product/security approval of role-per-tenant plus separate broker trust boundary.
2. Successor ADR for the raw-GUC conflict in ADR-W02-002.
3. Broker credential issuance, rotation, revocation, audit, and incident-response design.
4. Provider support and scale benchmarks for 10–10,000 roles and on-demand pools.
5. PostgreSQL real A/B negative proof, including A→B/B→A, pooling/reuse, revocation, children, and legacy waves.

## What Was Not Changed

No migrations, RLS policies, schemas, roles, credentials, Vault, Redis, Storage, packages, extensions, deployments, production data, or application source were changed. Existing historic branches and worktrees were not merged, reset, or rewritten.

## Final Status

> **BLOCKED — DO NOT IMPLEMENT.**

This is a design decision only. It does not claim RLS or W02 completion. The next step, after explicit approval, is an isolated broker/role architecture design and a PostgreSQL audit-environment proof—not production implementation.

## References

[1]: https://www.postgresql.org/docs/current/functions-info.html "session_user and current_user"
[2]: https://www.postgresql.org/docs/current/sql-set-session-authorization.html "Session authorization changes"
[3]: https://www.postgresql.org/docs/current/ddl-rowsecurity.html "RLS default deny, owner bypass and policy execution"
