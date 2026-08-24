# W02 — Storage / Root Documents Runtime Completion

## نطاق الإثبات

أثبت harness مستقل على PostgreSQL محلي **disposable** وprivate provider **memory-only** العقد `S01–S10` لمسار المستندات الخاصة. يمر كل data-plane operation عبر `TenantContext → Policy → TenantAccessBroker → TenantBoundPrismaExecutor → PrivateArtifactRepository`. سجل metadata يحمل organization owner وdocument owner وobject key خادمي immutable وversion وcontent attributes، ولا يقبل object path أو organizationId من العميل.

حُجر `src/lib/storage.ts` و`POST /api/upload` fail-closed؛ أزيلت fallbacks الخاصة بـMinIO وbucket credential وpublic URL. المسار الجديد هو `/api/documents`: يصدر delivery opaque قصير العمر من provider محقون، بعد فحص membership/session/policy/owner داخل الخادم. لا يوجد provider حقيقي أو credential أو bucket في source أو الدليل.

| البوابة | النتيجة المثبتة |
|---|---|
| `S01` | key خادمي خاص بـA، metadata tenant-bound، وعدم إعادة URL عام |
| `S02–S04` | list/delivery A/B، رفض guessed artifact، replace/delete أجنبي، ورفض beneficiary/path مزوّر قبل provider write |
| `S05` | delivery opaque قصير العمر، لا URL مباشر، وينتهي عند provider boundary |
| `S06` | stale policy وmembership revoked يرفضان delivery قبل الوصول إلى provider |
| `S07` | replace ينشئ version/key جديداً؛ delete يمنع delivery لاحقاً |
| `S08–S09` | provider outage fail-closed بلا metadata/object fallback، وA/B parallel keys وclients منفصلون |
| `S10` | RLS `session_user` على documents/private_artifacts، roles غير مالكة، correlation audit، cleanup وhygiene |
| المدقق المستقل | `valid: true`، بلا IDs مفقودة أو مكررة أو فاشلة؛ الدليل والمدقق مؤرشفان بصلاحية `0600` |

## بوابة الانحدار

نجحت `prisma validate` و`prisma generate` و`tsc --noEmit` وJest الكامل (**19 suites / 97 tests PASS**، مع suite واحدة skipped مسبقاً) وفحص communications والبناء الإنتاجي وفحص artifact hygiene. استخدم Prisma `DATABASE_URL` محلية تركيبية صالحة لغوياً فقط ولم يتصل بقاعدة إنتاجية. بقيت تحذيرات Prisma config deprecation وoptional `@valkey/valkey-glide` و`process.cwd` في Edge Runtime واصطلاح `middleware` deprecated غير حاجبة ولم تُفسر كدليل provider أو production readiness.

## حدود النتيجة

هذه **COMPLETE LIMITED AUDIT RUNTIME** لحد Storage/Root Documents المحلي. لا تثبت bucket production أو KMS/credential resolution أو malware scanning أو retention/backup أو provider availability أو DR/HA/scale. لا تعيد تفعيل أي surface raw upload أو public delivery، ولا تغلق Financial RLS أو W02 global closure قبل تحقق DT01–DT06 خارج الإنتاج.
