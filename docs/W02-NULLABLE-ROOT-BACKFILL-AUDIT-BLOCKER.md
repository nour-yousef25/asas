# W02 — Nullable-Root Backfill Audit Blocker

## الحالة

**BLOCKED — ARCHITECTURAL / SECURITY DECISION REQUIRED.** أثناء إعداد نطاق nullable-root لتمكين ownership صريح لـ`Member` و`KPI/KPIRecord`، ظهر تعارض بين عقد backfill control-plane وعزل `audit_logs` المطبق حالياً بـ`FORCE ROW LEVEL SECURITY`.

| العقد | الحقيقة المثبتة | التعارض |
|---|---|---|
| backfill | manifest صريح قد يتضمن roots لمنظمات متعددة ضمن apply واحد وtransaction واحدة | لا يملك control-plane global session هوية tenant واحدة قانونية لكل صف audit. |
| `audit_logs` | policy تعتمد `session_user → protected role-to-organization mapping` وتقبل منظمة واحدة فقط لكل login | control role لا يمكنه تسجيل audit rows لـA وB من session واحدة بلا مخالفة policy. |
| القيود الأمنية | ممنوع `BYPASSRLS` وowner/superuser وRaw GUC وdefault tenant وglobal fallback | لا يوجد مسار حالي آمن لإكمال audit متعدد المستأجرين داخل backfill. |

> لا يجوز علاج هذا التعارض بتعطيل RLS أو منح control role تجاوزاً أو تخمين منظمة من العضوية أو من `activeOrganizationId`. سيبطل ذلك ADR-W02-009 وأدلة Wave 1.

## العمل المحفوظ وغير المرقّى

أُعد successor migration توسعي فقط لإضافة `organizationId` nullable إلى `Member` و`KPI` و`KPIRecord`، إلى جانب prototype manifest fail-closed. **لم تُشغّل migration على إنتاج أو قاعدة مشتركة، ولم يجر backfill أو RLS أو migration rehearsal.** يبقى هذا العمل غير معتمد وغير مرقّى حتى يُحسم مسار audit control-plane.

## خيارات متوافقة محتملة

| الخيار | الوصف | ملاحظة أمنية |
|---|---|---|
| A | control-plane audit ledger مستقل لا يخضع tenant data-plane RLS، بتصميم immutable ومراجعة ownership/retention | يتطلب ADR/migration/authority مستقلة؛ لا يعيد استخدام `audit_logs` كـbypass. |
| B | تقسيم manifest وapply إلى عمليات tenant-bound منفصلة، لكل منها principal وlease و`session_user` للمنظمة المستهدفة | يتطلب عقد control-plane/tenant bridge وتفويض تشغيلي واضح، ولا يسمح global credential. |
| C | تأجيل سجل per-row في `audit_logs` إلى مرحلة لاحقة والاكتفاء بmanifest immutable خارجي | لا يعتمد إلا بقرار صريح لأن عقد backfill الحالي يتطلب audit. |

**التوصية:** الخيار A فقط بعد ADR محدد يفرق control-plane audit immutable عن tenant data-plane audit، ويثبت أنه لا يمنح أي route أو repository صلاحية تجاوز RLS. لا يُنفذ أي خيار تلقائياً في هذا الفرع.

## الأثر

يبقى dashboard المختلط محظوراً من tenant-bound cutover، وFinancial RLS محظوراً. لا تتأثر أدلة runtime المحدودة المغلقة لـBeneficiary وDonor/Donation وBudget/Expense، لكنها لا تحل هذا blocker.
