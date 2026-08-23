# W02 Broker Lifecycle Runtime Test Matrix

| ID | Proof | Expected result | Evidence |
|---|---|---|---|
| L01 | Tenant A lease uses A PostgreSQL principal | zero foreign rows | PASS |
| L02 | Tenant B lease uses B PostgreSQL principal | zero foreign rows | PASS |
| L03 | A and B descriptors are partitioned | different connection IDs | PASS |
| L04 | A lease presented with B context | deny before authority operation | PASS |
| L05 | Consumed lease replay | `LEASE_REPLAY` | PASS |
| L06 | Stale session | `STALE_SESSION` | PASS |
| L07 | Stale policy snapshot | `STALE_POLICY` | PASS |
| L08 | Principal revocation | `PRINCIPAL_MAPPING_ABSENT` | PASS |
| L09 | Credential generation rotation | only new active principal executes with zero foreign rows | PASS |
| L10 | Authority uncertainty | `AUTHORITY_OR_OPERATION_FAILURE` | PASS |

All IDs are mandatory. The independent validator rejects missing, duplicate, invalid, failed, cleanup-failed, credential-persistence, production-touch, or hard-failure evidence.
