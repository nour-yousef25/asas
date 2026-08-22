# W02 RLS Context Attestation Acceptance Test Matrix

**قاعدة الاختبار:** PostgreSQL audit database حقيقية وapp role حقيقية غير مالكة وغير `BYPASSRLS`. لا mocks. كل اختبار 4 و5 و18 ينفذ SQL/direct Prisma عبر app role، لا helper application فقط.

| # | الحالة | التنفيذ المتوقع | النتيجة |
|---:|---|---|---|
| 1 | no context | direct SELECT/INSERT/UPDATE/DELETE | DENY/zero rows وفق العملية |
| 2 | valid A | signed A capability في A PID/XID | A rows only |
| 3 | valid B | signed B capability في B PID/XID | B rows only |
| 4 | A → B switch | attest A ثم raw GUC/attest B في نفس XID | DENY، لا B rows |
| 5 | B → A switch | attest B ثم raw GUC/attest A في نفس XID | DENY، لا A rows |
| 6 | forged capability | bad signature | DENY |
| 7 | expired capability | `exp` منتهٍ | DENY |
| 8 | revoked capability | `kid` أو JTI revoked | DENY |
| 9 | wrong organization | claim/token B مع session A | DENY |
| 10 | wrong membership | membership claim غير active/tenant mismatch | DENY |
| 11 | stale policy | policy version سابق | DENY |
| 12 | stale session | session version/revocation mismatch | DENY |
| 13 | replay | استعمال JTI ثانية أو على XID/PID آخر | DENY |
| 14 | rollback | attest ثم rollback ثم re-use connection | no binding/context leakage |
| 15 | connection reuse | transaction A تنتهي ثم B على نفس backend | new capability required; no A rows |
| 16 | concurrency | A وB concurrent interactive transactions | strict A/B isolation |
| 17 | child ownership | A tries B-owned child and B parent relation | DENY |
| 18 | direct app SQL | app role executes SQL/verifier directly | same enforcement as route |
| 19 | malformed capability | encoding/claim schema invalid | DENY |
| 20 | verifier/key registry fault | unavailable/timeout/unknown verifier result | DENY |
| 21 | raw GUC mutation | `set_config` after valid attest | no change to verified tenant |
| 22 | invalid audience/instance | token from other DB/restore | DENY |
| 23 | key rotation overlap | retiring key before cutoff | allowed only under documented overlap |
| 24 | key revoke | capability from revoked key | DENY immediately |

لكل اختبار يحتفظ evidence بالـrun ID والـcommit وmigration IDs لاحقاً وapp role attributes وreason code؛ لا يحتفظ token أو key أو database URL. لا يعتبر التصميم منفذاً أو آمناً قبل PASS لكل الصفوف، وخصوصاً 4 و5.
