# W02 — سلطة اتصال Prisma المقيدة بالمستأجر

## القرار وحالة النطاق

**الحالة: مكتمل كدليل runtime تدقيقي قابل للتكرار.** أزيل blocker الذي كان يمنع بدء **RLS Wave 1 — Beneficiary**: لم يعد مسار `BeneficiaryRepository` يملك default إلى `PrismaClient` العالمي، بل ينفذ كل عملية tenant data-plane من خلال `TenantBoundPrismaExecutor` الذي يصدر lease من Broker ثم يمرر client tenant-bound مؤقتاً إلى العملية وحدها.

هذا ليس تهيئة إنتاجية ولا تصريحاً بتشغيل provider في Cloud أو Dedicated أو Self-Hosted. `TenantConnectionProvider` يبقى boundary خارج التطبيق: إذا لم يثبَّت executor فلا توجد fallback؛ ويُرفض الطلب بـ`TENANT_CONNECTION_AUTHORITY_UNCONFIGURED`. لا تحتوي هذه الشفرة على URL أو كلمة مرور أو credential selector إنتاجي.

## مسار السلطة

| المرحلة | المسؤول | الضمان |
|---|---|---|
| 1 | `requireTenantContext` | سياق server-side يحمل organization، العضوية، sessionVersion، policySnapshotVersion وcorrelationId؛ لا يأتي sessionVersion من العميل. |
| 2 | `TenantBoundPrismaExecutor` | يصدر lease جديداً لكل عملية repository، ولا يمرر أي descriptor إلى caller. |
| 3 | `TenantAccessBroker` | يتحقق من user/membership/session/policy/principal/context fingerprint ثم يستهلك lease مرة واحدة. |
| 4 | `TenantBoundPrismaCredentialAuthority` | يطلب من provider الخارجي client للـprincipal المطابق، ويستدعي `discard()` دائماً عبر `finally`. |
| 5 | `TenantConnectionProvider` | deployment-owned؛ يحل credentialReference المعتم داخلياً، ويتحقق من PostgreSQL `session_user` قبل تسليم Prisma للعملية. |
| 6 | `BeneficiaryRepository` | يرى `PrismaClient` tenant-bound ضمن callback فقط؛ لا يستورد `db.ts` ولا يعرف URL/سرّ/selector. |

> **الهوية الموثوقة للـRLS لاحقاً هي `session_user` الذي يثبته provider من LOGIN principal مقيد بالمستأجر. لا يشكل client organization أو Raw GUC أو global role أو owner/superuser/BYPASSRLS مصدراً للهوية.**

## الأدلة

جدول A01–A15 مستقل في `W02-TENANT-BOUND-RUNTIME-CONNECTION-AUTHORITY-EVIDENCE.json`، والتحقق fail-closed في ملف validation المقابل. يثبت الجدول، على PostgreSQL disposable، غياب fallback، A/B `session_user` من Prisma، partition/discard، التوازي، replay والexpiry والrevocation، repository write، rotation، provider failure، rollback، restart semantics، وفحص source وخصائص roles. كانت mandatoryIds مساوية تماماً للـexecutedIds، ونجح cleanup بلا database أو roles متبقية.

أعيد أيضاً تشغيل ownership proof O01–O07 عبر authority بدلاً من app-role Prisma مباشر. يضيف O07 إثبات أن عمليات data-plane استهلكت Broker leases.

## حدود القرار وفتح البوابة التالية

| البند | القرار |
|---|---|
| blocker `W02-RLS-WAVE-1-RUNTIME-AUTHORITY` | **RESOLVED FOR AUDIT RUNTIME**؛ شرط البدء في RLS Wave 1 مُستوفى. |
| PostgreSQL RLS policy/migration | **غير منفذة بعد**؛ يجب أن تكون scope مستقلة مع migration successor وrehearsal/rollback evidence. |
| Production provider/workload identity/KMS/HA/scale | **OPEN**؛ لا يجوز اختراع إعداد دائم أو استخدام audit credentials كإنتاج. |
| باقي repositories | **غير محولة**؛ لا يعتمد هذا التقرير على مساراتها ولا يسمح بتفعيل RLS لها. |
| W02 global closure | **غير جاهز**؛ Queue/Storage/IAM/Documents/family waves وغيرها خارج هذا النطاق. |

## مراجع داخلية

- [ADR-W02-009-TENANT-BOUND-RLS-IDENTITY.md](./ADR-W02-009-TENANT-BOUND-RLS-IDENTITY.md)
- [W02-TENANT-BOUND-RUNTIME-CONNECTION-AUTHORITY-EVIDENCE.json](./W02-TENANT-BOUND-RUNTIME-CONNECTION-AUTHORITY-EVIDENCE.json)
- [W02-TENANT-BOUND-RUNTIME-CONNECTION-AUTHORITY-EVIDENCE-VALIDATION.json](./W02-TENANT-BOUND-RUNTIME-CONNECTION-AUTHORITY-EVIDENCE-VALIDATION.json)
- [W02-BENEFICIARY-OWNERSHIP-RUNTIME-EVIDENCE.json](./W02-BENEFICIARY-OWNERSHIP-RUNTIME-EVIDENCE.json)
