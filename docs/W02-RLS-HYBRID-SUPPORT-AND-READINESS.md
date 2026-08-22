# W02 RLS Hybrid Tenant-Bound Identity Proof — Support and Readiness

## Support Matrix

| Model | Tenant role owner | Broker/credential owner | DBA boundary | Status |
|---|---|---|---|---|
| Cloud SaaS | ASAS/approved managed operations | ASAS-approved external authority | provider superuser/host is outside RLS boundary | BLOCKED pending provider and broker contract |
| Dedicated | contract-defined ASAS/customer owner | contract-defined authority | privileged customer/DBA outside RLS boundary | BLOCKED pending responsibility acceptance |
| Self-Hosted | operator | operator | DBA/superuser/host administrator outside RLS boundary | BLOCKED pending operator runbook and proof |

No mode assumes a customer extension, HSM, or provider-specific KMS as a core PostgreSQL security boundary. Each must, however, provide an external authority able to manage a separate tenant credential lifecycle; without this, the central runtime could accumulate universal tenant credentials and defeat the proposed boundary.

## RLS Wave 1 Readiness

| Gate | Result |
|---|---|
| tenant-bound PostgreSQL A/B proof | PASS — audit fixture only |
| Broker implementation and failure proof | BLOCKED |
| session/membership/policy stale proof | BLOCKED |
| production credential authority/rotation/runbook | BLOCKED |
| provider support and scale benchmark | BLOCKED |
| Beneficiary ownership/API/TenantContext/permission prerequisites | previously partial foundation; must be revalidated per wave |
| RLS Wave 1 authorization | **NOT READY** |

No RLS migration is authorized by this proof. The next isolated authorization, if the unresolved broker and operations gates are accepted, is a broker proof package—not Beneficiary RLS Wave 1.
