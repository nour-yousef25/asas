# ASAS PLUS — W02 IMPLEMENTATION PLAN

**الحالة:** Draft for approval.
**قاعدة التنفيذ:** لا يبدأ أي work package قبل اعتماد `W02-PRE-EXECUTION-ARCHITECTURAL-READINESS-REPORT.md`. جميع migrations مستقبلية forward-only وexpand-first، ولا تستخدم `prisma db push` أو rewrite للتاريخ.

## Guiding Principles

ينفذ W02 باعتبار `Organization` هي Tenant، مع دفاع متعدد الطبقات لا يعتمد على UI أو client input أو global JWT role. تبقى النواة واحدة عبر Cloud/Dedicated/Self-Hosted؛ تختلف ownership وprovisioning لا policy أو data model.[1]

## Work Packages and Sequence

| WP | المخرجات | يعتمد على | DoD | التحقق |
|---|---|---|---|---|
| WP0 | ADRs/Gates وpermission catalog وlegacy mapping decision | اعتماد الخطة | جميع G-W02-1..8 موثقة | architecture review |
| WP1 | tenant-context/authz kernel وsession/policy versions | WP0 | لا route حساس بلا server tenant context | unit + stale-session/role tests |
| WP2 | IAM data model وpolicy evaluator وmembership role migration | WP1 | roles per org وSoD وoverrides مدققة | policy matrix/negative tests |
| WP3 | foundation migration M1 وDEP-003 instance identity | WP0 | instance identity/audit stable وnon-destructive | migration/tamper/transfer tests |
| WP4 | tenant key migration M2/M3 وlegacy backfill tooling | WP0/WP1 | explicit mapping/dry-run/validation، no null/orphan | two-org fixture/migration rehearsal |
| WP5 | repository/API cutover وtenant RLS rollout M4/M6 | WP2/WP4/ADR-W02-009 lifecycle gates | all scoped families enforce context؛ no unscoped write | IDOR/direct-query/RLS suite |
| WP6 | vault/secret records وstorage object contract | WP1/WP2/G-W02-5/8 | encrypted/revocable/audited secrets وexpiring private objects | rotation/download/redaction tests |
| WP7 | privacy classification/consent/retention/export/audit-v2 | WP2/WP4/WP6 | purpose/masking/DSAR/legal-hold rules | privacy/export/audit tests |
| WP8 | LIC-001 certificate verification وLIC-002 activation core | WP3/WP6/G-W02-7 | public-key verify، hashed one-time activation/audit/rate limit | signature/replay/expiry tests |
| WP9 | IDP-001 provider framework base | WP2/WP6 | tenant provider config/sandbox-prod/mapping/rotate/disable/audit | OAuth/provider contract tests |
| WP10 | hardening, migration rehearsal, W02 Closure Matrix | WP1–WP9 | all acceptance suites pass، no cross-tenant evidence | build/TS/Jest/integration/audit DB rehearsal |

## Proposed Migration Order

1. `2026xxxx_w02_security_primitives_expand`: new enums/tables only: policy roles, memberships-role join, policy versions, instance identity, certificate metadata, activation audit, audit-v2 scaffolding.
2. `2026xxxx_w02_tenant_roots_expand`: nullable `organizationId` on root legacy aggregates, non-blocking indexes and FKs. No destructive uniqueness changes.
3. Audited backfill CLI with `--dry-run` and explicit legacy organization mapping. It must refuse ambiguous data and emit a redacted report.
4. `2026xxxx_w02_tenant_constraints_harden`: only after backfill validation; apply `NOT NULL`, composite uniques and scoped indexes.
5. `2026xxxx_w02_tenant_children_and_file_refs`: children inherit/validate root ownership; introduce StoredObject references alongside legacy URLs.
6. `2026xxxx_w02_vault_privacy_identity`: SecretRecord/SecretAccessAudit/privacy request/retention/IDP models and any additive certificate/activation fields.
7. RLS migrations occur only for a fully converted table family after tenant-bound login/Broker lifecycle, protected role mapping, and direct-query negative tests. PostgreSQL `session_user` maps to organization; no custom GUC is an identity anchor. No all-schema RLS switch in one migration.

## Required Tenant Context Contract

```ts
type TenantContext = Readonly<{
  organizationId: string;
  membershipId: string;
  userId: string;
  policySnapshotVersion: number;
  correlationId: string;
}>;
```

The client never creates this object. Server middleware/service resolves the authenticated user, verifies an active membership and its security version, then passes context to the policy evaluator and repository. `organizationId` from request body/query is permitted only for explicit, authorized organization switching and is not accepted by business commands.

## Repository and API Conversion Rules

Every converted repository exposes `list(context, ...)`, `getById(context, id)`, `create(context, input)`, `update(context, id, input)` and `deleteOrArchive(context, id)`. It adds organization filters internally, checks relation ownership before mutations, uses `404` for cross-tenant resource discovery where policy requires it, and writes a security audit event for sensitive decisions. API routes call policy services; they do not pass Prisma straight from route handlers for sensitive domain operations.

The conversion order is high-risk data first: Beneficiary/Documents, Donor/Donations/Invoices, Reports/Exports, Users/Memberships, Uploads/Files, then communications and remaining operational models. Existing communications scope is retained and normalized into the common contract; it is not rewritten as a separate tenant system.

## IAM and Policy Baseline

The permission registry uses stable semantic names such as `beneficiary.read`, `beneficiary.export`, `identity.membership.manage`, `secret.rotate`, `report.generate`, and `support.impersonation.request`. Organization roles are local bindings to that registry. Policy evaluation accepts a resource descriptor including organization, classification, owner/assignee and purpose; deny wins over allow. A platform support role is explicit, tenant-bound, time-limited and fully audited; it never silently inherits `SUPER_ADMIN` global access.

## Vault and Storage Contract

Secrets are encrypted ciphertext only, versioned, scoped to organization/provider/purpose and accessed through a service that emits redacted audit. Secret rotation is transactional at the reference level with test connection masked; decryption is permitted only in a narrow worker/service runtime. Files use `StoredObject` metadata and private tenant prefixes. Download URLs are generated after policy checks, expire rapidly, carry no durable credential and are invalidated on object revoke/classification change.

## License and Identity Provider Boundaries

W02 supplies local verification for a signed certificate and activation core records. It does not create the central license-management service, advanced transfer/recovery, offline request/response or customer-success workflows, which remain W19.[2] `IDP-001` supplies only a provider framework; Nafath remains W15 and cannot be labelled enabled until approvals, tenant credentials, sandbox and UAT exist.[2]

## Mandatory Test Plan

| Suite | Must prove |
|---|---|
| `tenant-isolation` | two organizations; all CRUD, nested relation, pagination/search and direct ID manipulation cannot cross boundary |
| `policy-matrix` | allow/deny, role changes, overrides, SoD and inactive memberships |
| `session-security` | disabled user/membership and changed policy invalidates old JWT |
| `migration-tenant-backfill` | explicit mapping, dry-run, ambiguity refusal, no null/orphan, composite unique correctness |
| `storage-security` | cross-org download denied, signed URL expiry/revoke, upload classification/path/content validation |
| `secret-vault` | encrypt/decrypt authorization, rotation/revocation, no plaintext in logs/API/audit |
| `privacy-audit` | classification, mask/purpose, export/DSAR/retention/legal-hold and audit redaction |
| `queue-cache-tenant` | tenant envelope, worker ownership/replay/idempotency, cache namespace/invalidation |
| `license-activation` | certificate verify/key version/expiry, one-time activation/replay/rate limit/audit |
| `idp-framework` | provider tenant isolation, sandbox/prod separation, callback state, mapping and secret rotation |
| `regression` | migration deploy/generate/validate/seed, TypeScript, Jest, communications, build, runtime harness and Health |

## Release Gates for W02 Closure

W02 closes only when tenant isolation suite passes across DB/API/repository/files/jobs/cache/export; certificate and activation negative suites pass; secret rotation/policy tests pass; all migrations succeed on clean and upgraded audit databases; and no route in the scoped API inventory has an unbounded Prisma data-plane query. The existing W01 production dependency register remains open and is reported separately; it must not be hidden by W02 tests.

## Explicit Non-Goals

W02 does not deliver full configuration-as-data, entitlement engine, installer UX, brand/white label, Nafath, offline activation, transfer/recovery/full DR, financial/beneficiary domain completion or production deployment. Those belong to W03, W11, W15, W19 or subsequent domain waves.[2]

## References

[1] [Master Product Development Blueprint v1.1](../../asas-app-workspace/asas-plus-master-product-development-blueprint-v1.1.md) — tenant/security architecture and one-core deployment rule.
[2] [Deployment & Lifecycle Wave Mapping](../../asas-app-workspace/asas-plus-deployment-wave-mapping.md) — W02, W15 and W19 boundaries.
[3] [W02 Pre-Execution Architectural Readiness Report](./W02-PRE-EXECUTION-ARCHITECTURAL-READINESS-REPORT.md) — evidence-led source audit and decision gates.
