# W02 RLS Alternative Architecture — Decision

**الحالة:** `SUPERSEDED AS DECISION SOURCE BY ADR-W02-009; RETAINED AS DESIGN RATIONALE`.

## القرار المقترح

يعتمد البديل المقترح **Hybrid Tenant-Bound Login Principal**: تكون هوية tenant داخل قاعدة البيانات هي `session_user` الناتجة من PostgreSQL login role مستقلة لكل منظمة، لا custom GUC ولا `SET ROLE` ولا claim يختاره التطبيق. تستخدم RLS لاحقاً دالة security-definer تقرأ role OID الخاص بـ`session_user` من mapping مملوك لـsecurity owner فقط. تنشئ **Tenant Access Broker** مستقلة عن application runtime اتصالاً أو lease لrole المنظمة بعد التحقق من session/membership/policy؛ ولا يحصل التطبيق العام على أسرار أو memberships تسمح له باختيار role منظمة أخرى.

> هذا لا يدّعي أن قاعدة البيانات تستطيع معرفة صحة session تطبيقية من دون Root of Trust خارجي. ما تفرضه القاعدة هو أن connection authenticated كـA لا تستطيع أن تصبح B داخل transaction أو عبر `SET ROLE` أو GUC؛ أما منح اتصال B فهو سلطة broker مستقلة يجب عزلها عن application runtime.

## Trust-Boundary Diagram

```text
Client ── authenticated session ──> Tenant Access Broker
                                      │ validates membership/session/policy
                                      │ chooses tenant-bound DB principal A only
                                      ▼
Application operation ──────────> PostgreSQL connection as tenant_A
                                      │ session_user=tenant_A (immutable to non-superuser)
                                      ▼
                             security.role_to_org(session_user OID)
                                      ▼
                                  RLS tenant policy
```

## Required Role Strategy

| Role | Attribute and authority | Forbidden authority |
|---|---|---|
| `db_owner` | table/schema ownership; no runtime login | application connection, `BYPASSRLS` runtime |
| `security_owner` | owns `security` schema/mapping functions; no application login | tenant-table DML, private customer data routine access |
| `migrator` | controlled migration operation, separate credential | application runtime, pooled tenant queries |
| `tenant_<org>_rw` | `LOGIN NOINHERIT NOBYPASSRLS NOCREATEROLE`; tenant data group usage only | memberships with `SET`, DDL, security schema DML, role administration |
| `tenant_<org>_ro` | optional separate read-only principal | writes, security schema DML, role switching |
| worker/reporting | obtains tenant-bound lease per operation | global all-tenant role in data plane |
| DBA/superuser | explicit operational bypass boundary | not covered by RLS; audited Responsibility Matrix |

Tenant roles may inherit data-plane object grants from a non-login `tenant_data_access` role **only** with `SET FALSE` and no administrative membership. RLS identity reads `session_user`, not `current_user`; `SET ROLE` cannot turn A into B because A has no SET-capable membership in B. PostgreSQL documents that `SET ROLE` requires a membership chain with `SET TRUE`, while a non-superuser cannot change session authorization to another authenticated role.[1] [2]

## Comparison

| Criterion | A. Per-tenant roles/connections | B. PostgreSQL-native immutable identity only | C. Selected hybrid |
|---|---|---|---|
| Tenant root of trust | login principal/credential | no independent native identity beyond login role | broker-authorized tenant login principal |
| A→B inside one transaction | deny if no B membership/credential | impossible without A | deny by tenant role + `session_user` map |
| Raw GUC mutation | irrelevant if policy uses role | not a solution by itself | no effect |
| App with universal B credentials | can open B connection; boundary fails | same limitation | prohibited by broker credential separation |
| Connection pooling | pool per authenticated tenant identity | undefined without role identity | tenant-partitioned/on-demand pools; reset/discard on return |
| Cloud/Dedicated/Self-hosted | PostgreSQL roles are core feature | not sufficient independently | core Postgres plus provider-neutral broker contract |
| 10–10,000 organizations | role/provisioning growth; benchmark required | no implementation path | roles grow linearly; broker and credential lifecycle are mandatory |
| Extension/KMS dependency in DB | none | none | no crypto extension; KMS may protect broker credentials but is not DB core |

Option B collapses into Option A because core PostgreSQL offers no immutable request tenant identity distinct from the authenticated login principal. Option A alone fails the stated application-compromise goal if one application process holds credentials for every tenant. Option C makes credential selection a separately protected security service and uses native PostgreSQL login identity as the database anchor.

## Explicit Rejections

Raw GUC/current_setting, trusted global app role, application-only TenantContext, HMAC/private key in PostgreSQL, unsupported asymmetric extension, custom crypto, `organizationId IS NULL` allow, default organization, `organizationMemberships[0]`, and global reporting/worker data-plane bypass remain rejected.

## Conflict With ADR-W02-002

ADR-W02-002 historically named `set_config/current_setting` as RLS identity. The direct A→B app-role test falsified that security assumption. ADR-W02-009 now supersedes the identity section formally; phased-family and owner/migrator separation portions remain valid. Implementation still requires separate lifecycle, support, and negative-evidence gates.

## References

[1]: https://www.postgresql.org/docs/current/role-membership.html "Role membership and SET ROLE"
[2]: https://www.postgresql.org/docs/current/sql-set-session-authorization.html "Session authorization limits"
[3]: https://www.postgresql.org/docs/current/ddl-rowsecurity.html "Row security, owner bypass and policy behavior"
