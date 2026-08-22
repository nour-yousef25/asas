# W02 WP0 — ADR Index

**النطاق:** قرارات WP0 المعمارية والأمنية قبل WP1 فقط.
**الحالة:** `ALL DESIGN GATES CLOSED`; التنفيذ والإثبات runtime مؤجلان إلى WP1 وما بعده.

| Gate | ADR | القرار المختصر | الحالة |
|---|---|---|---|
| G-W02-1 | [ADR-W02-001](./ADR-W02-001-TENANT-CANONICAL.md) | `Organization` هي Tenant canonical | CLOSED |
| G-W02-2 | [ADR-W02-002](./ADR-W02-002-RLS-STRATEGY.md) | RLS تدريجي مع app role غير مالك وسياق transaction-local | CLOSED |
| G-W02-3 | [ADR-W02-003](./ADR-W02-003-LEGACY-DATA-MAPPING.md) | mapping صريح مدقق يرفض ambiguity/orphan | CLOSED |
| G-W02-4 | [ADR-W02-004](./ADR-W02-004-IAM-PERMISSION-SOD.md) | membership-scoped RBAC/ABAC، deny-over-allow وSoD | CLOSED |
| G-W02-5 | [ADR-W02-005](./ADR-W02-005-KMS-SECRET-OWNERSHIP.md) | envelope encryption وedition-specific KMS ownership | CLOSED |
| G-W02-6 | [ADR-W02-006](./ADR-W02-006-PRIVACY-RETENTION-LEGAL-HOLD.md) | classification/purpose/retention/legal-hold وredacted audit | CLOSED |
| G-W02-7 | [ADR-W02-007](./ADR-W02-007-ACTIVATION-BUSINESS-RULES.md) | one-time hashed activation bound إلى instance ومدقق | CLOSED |
| G-W02-8 | [ADR-W02-008](./ADR-W02-008-STORAGE-SIGNING-SCANNING.md) | private S3-compatible storage، org keys، URLs قصيرة وquarantine | CLOSED |

> `CLOSED` هنا يعني أن القرار المعماري له owner ومعيار قبول ومسار إثبات. لا يعني أن runtime أو migrations أو W02 feature implementation نُفذت في WP0.
