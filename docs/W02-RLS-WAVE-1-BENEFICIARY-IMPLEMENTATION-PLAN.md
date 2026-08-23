# W02 RLS Wave 1 — Beneficiary Implementation Plan

## Scope and identity contract

تغطي هذه الموجة حصراً `beneficiaries` و`beneficiary_documents` و`audit_logs` التي يكتبها `BeneficiaryRepository`. لا تشمل migration أي family آخر أو أي root قابل لـ`NULL` خارج هذه العائلة. مرساة الهوية هي PostgreSQL `session_user` الصادر من LOGIN principal مقيد بالمستأجر، والمربوط بـorganization واحدة عبر `security.role_to_organization` المحمية؛ لا توجد GUC أو قيمة عميل أو default membership أو global role في policy.

## Migration and recovery design

| البند | القرار |
|---|---|
| نوع migration | successor forward-only باسم `20260823080000_w02_rls_wave1_beneficiary_session_user`؛ لا يُحرَّر أي تاريخ. |
| mapping | role OID وorganization واحدة active فقط، مع unique partial indexes للـrole والـorganization. |
| function | `SECURITY DEFINER`، `STABLE`، search path ثابت، لا تقرأ سوى map المحمية ولا تقبل input. |
| policies | `FOR ALL` و`FORCE ROW LEVEL SECURITY` على family كاملة؛ `USING` و`WITH CHECK` يمنعان foreign/null rows. |
| rollback التشغيلي | migration successor منفصلة بعد إيقاف write path؛ لا rollback history. لا تُنشأ ضمن هذه الموجة. |
| production | غير مفعلة؛ rehearsal على PostgreSQL disposable فقط. |

## Evidence matrix

| ID | الدليل المطلوب |
|---|---|
| R01 | no mapping لا يرى ولا يكتب. |
| R02–R03 | A↔B direct reads/writes لا تعبر tenant boundary. |
| R04–R05 | Raw GUC/client spoof و`SET ROLE` لا يغيران `session_user` أو RLS result. |
| R06–R07 | discard/reuse وparallel A/B يحافظان على identity والصفوف. |
| R08 | Broker lease/session/policy/principal revocation يرفض runtime الجديد. |
| R09 | authority/provider failure يرفض بلا global fallback. |
| R10 | role-map rotation يمنع old role ويفتح new principal فقط. |
| R11 | BeneficiaryDocument join لا يسرب child عبر parent. |
| R12 | BeneficiaryRepository يعمل فقط عبر Broker-bound tenant Prisma. |
| R13 | pages تستخدم permission semantics وrepository لا يستورد global `db.ts`. |
| R14 | nullable/unmapped beneficiary لا يمكن قراءته أو إدخاله من tenant role. |
| R15 | clean migration rehearsal وpolicy/FORCE RLS/cleanup/validator pass. |

لا تعتبر أي حالة PASS إذا اختلف mandatory عن executed، أو فشل cleanup، أو ظهرت credential/URL في evidence، أو شغّل owner/superuser/BYPASSRLS اختبار tenant access.
