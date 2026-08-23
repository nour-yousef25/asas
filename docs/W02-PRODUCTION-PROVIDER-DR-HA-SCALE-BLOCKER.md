# W02 — Production Provider DR/HA/Scale Evidence Blocker

## الحالة

**BLOCKED — OPERATING ENVIRONMENT / ARCHITECTURE EVIDENCE REQUIRED.** أثبتت A01–A15 وF01–F10 وBE01–BE10 وD01–D10 authority audit-runtime على PostgreSQL disposable، لكنها لا تثبت سلوك provider الإنتاجي في Cloud/Dedicated/Self-Hosted. `TenantConnectionProvider` boundary deployment-owned عمداً، ولا توجد في التطبيق URL أو credential selector أو workload identity أو pool topology يمكن اختبارها محلياً بصورة تماثل الإنتاج.

| المطلوب قبل Financial RLS | سبب عدم إمكان إثباته محلياً |
|---|---|
| provider failover وconnection recovery | يعتمد على topology وhealth routing وcredential resolver خاص بالنشر. |
| HA/DR وrestore/revocation semantics | يتطلب بيئة target وخطة backup/restore وRPO/RTO ومسؤولية تشغيلية معتمدة. |
| pool/role scale وcapacity exhaustion | يتطلب limits حقيقية لـPostgreSQL/pooler/provider لا يجوز اختراعها داخل harness. |
| rotation/workload identity | يتطلب secret/KMS/identity boundary خارج repository ولا يجوز تحويل audit credentials المؤقتة إلى بديل. |

> لا يعالج هذا blocker بإضافة global credential أو ENV universal URL أو owner/superuser أو `BYPASSRLS` أو Raw GUC. أي من ذلك يخرق ADR-W02-009، ولا يقبل كدليل DR/HA/scale.

## العمل المتروك والمحفوظ

يبقى فرع `w02-member-kpi-cutover-preservation` منفصلاً وغير مدمج لأنه يحتوي تحويل Member/KPI لم يستوف runtime evidence العائلي بعد. لا يمس هذا blocker أدلة العائلات المغلقة تدقيقياً ولا يغير migrations أو الإنتاج.

## الاستئناف الآمن

يتطلب الاستئناف تعريف deployment-owned provider target وعقد تشغيل مكتوب يحدد topology، role provisioning، workload identity، rotation، pool limits، health/failover، backup/restore وRPO/RTO. بعد توفر بيئة تدقيق تشبه target من دون بيانات إنتاج، ينفذ rehearsal مستقل DR/HA/scale ثم يعاد تقييم بوابة Financial RLS.
