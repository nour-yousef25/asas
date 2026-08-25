# Production Readiness Gate Matrix — Reconciliation 54

هذه المصفوفة تستبدل افتراضات S3/IdP/certificate/payment-exclusion السابقة بقرارات المنتج الحالية. **CLOSED** يعني دليل قائم؛ **IMPLEMENTABLE NOW** يعني قراراً وتنفيذاً داخلياً آمناً متبقياً بلا مدخل مزود مختلق؛ **EXTERNAL INPUT REQUIRED** يعني أقل مدخل حقيقي لا يمكن اختراعه؛ و**PRODUCTION CUTOVER ONLY** محظور في هذه الجولة.

| Gate | الحالة | ما ينجز داخلياً الآن | أقل مدخل خارجي إن بقي | حد الإطلاق |
|---|---|---|---|---|
| W02، DB/RLS/Broker/Redis/queue/worker/backup/restore/rollback | `CLOSED` | لا يعاد فتحه. | لا شيء. | ليس blocker جديداً. |
| Bootstrap authentication/control plane | `IMPLEMENTABLE NOW` | provision flow audited، Super Admin/Organization Admin authority وno-demo guards. | identity/email/approval وinitial secret فقط عند إنشاء الحساب الحقيقي. | لا IdP مطلوب في الإطلاق الأول. |
| IdP | `PRODUCTION CUTOVER ONLY` | يبقى extension provider-neutral لاحقاً. | لا شيء للإطلاق الأول. | لا يمنع Bootstrap launch. |
| Local VPS storage | `IMPLEMENTABLE NOW` | local private adapter، tenant directories/ownership، private delivery، A/B proof وbackup implications. | لا provider credential؛ يلزم فقط اختيار root-owned production path عند تثبيته. | لا S3 gate للإطلاق. |
| SMTP temporary mail | `EXTERNAL INPUT REQUIRED` | SMTP abstraction/redaction/test harness. | host/port/TLS/auth secret reference/sender/owner approval من schoolscreen.sa. | test connection ثم رسالة اختبار approved فقط. |
| Platform billing | `IMPLEMENTABLE NOW` | plan/subscription/invoice/transaction ledger/reconciliation/refund-void contracts. | Mada-compatible gateway configuration/credentials لاحقاً. | provider E2E مطلوب قبل تحصيل حقيقي. |
| Organization donations | `IMPLEMENTABLE NOW` | tenant-aware payment configuration، ledger/reconciliation/webhook binding وA/B negatives. | Mada-compatible provider configuration/credentials لاحقاً. | لا donation transaction حقيقي قبل provider proof. |
| Payment provider/gateway | `EXTERNAL INPUT REQUIRED` | architecture complete لا تلمس card data. | provider contract، merchant identifiers، API/webhook secrets، sandbox/UAT approval. | مطلوب قبل إطلاق الدفع الفعلي. |
| SaaS license/entitlements | `IMPLEMENTABLE NOW` | states ACTIVE/SUSPENDED/EXPIRED، entitlements مستقلة عن payment وSuper Admin control. | لا certificate خارجي لإطلاق SaaS. | certificate extension فقط لـDedicated/Self-Hosted. |
| Scheduler catalogue | `IMPLEMENTABLE NOW` | inventory/classification، tenant-bound dry-run وheartbeat/lag proof في staging. | owner approval للـcatalogue والتشغيل الفعلي فقط. | job غير آمن يبقى disabled. |
| Go/No-Go owner/window | `EXTERNAL INPUT REQUIRED` | preflight and evidence path. | owner/window approval file. | ضروري قبل cutover فقط. |
| DNS/public vhost/traffic | `PRODUCTION CUTOVER ONLY` | لا شيء في هذه الجولة. | phrase صريحة بعد Go. | محظور الآن. |
