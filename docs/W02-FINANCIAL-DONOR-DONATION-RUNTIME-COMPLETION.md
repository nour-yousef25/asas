# W02 — إغلاق دليل التشغيل المالي لعائلة Donor/Donation

## النتيجة وحدودها

أُغلق نطاق **Donor/Donation/Campaign/Project/Invoice/DonorCommunication** كدليل تشغيل تدقيقي محلي فقط. يثبت الدليل أن المسارات المحوّلة في `FinancialRepository` تعمل عبر سلسلة الهوية الوحيدة المسموح بها: tenant PostgreSQL `LOGIN` principal ثم `session_user` المتحقق منه داخل provider التدقيقي، ثم Broker lease أحادي الاستخدام، ثم Prisma tenant-bound. لا يسجل الدليل بيانات اعتماد أو URL اتصال، ولم يلمس أي قاعدة أو بيئة أو بيانات إنتاج. [1] [2]

> لا يعني هذا الإغلاق تفعيل RLS المالي، أو جاهزية الإنتاج، أو إغلاق عائلة Budget/Expense، أو إدخال dashboard المختلط ضمن الحماية. تبقى هذه بوابات مستقلة ومفتوحة صراحةً.

| مجموعة الإثبات | النتيجة المدققة | الحد الأمني المثبت |
|---|---|---|
| F01 | PASS | `FinancialRepository` يستهلك lease ويصل إلى Prisma مصادق عليه بهوية A عبر `session_user`. |
| F02–F05 | PASS | عزل list/read، رفض child write وforeign donation relations، وحفظ ملكية donation/invoice الصحيحة. |
| F06–F09 | PASS | منع replay/revocation/stale-session، rotation إلى principal جديد، outage fail-closed، وعزل parallel/discard. |
| F10 | PASS | أدوار التدقيق غير superuser وغير `BYPASSRLS`، ولا raw GUC أو global Prisma أو `DATABASE_URL` fallback في repository. |
| Validator وcleanup وhygiene | PASS | تغطية F01–F10 exact، residue صفر، evidence محمي 0600، وفحص hygiene ناجح. |

## ما لم يُغلق

لا توجد migration مالية جديدة، ولا سياسة RLS مالية، ولا backfill لroots القابلة لـ`NULL`، ولا تهيئة production `TenantConnectionProvider`. كما تبقى عائلة **Budget/Expense** ومسار **dashboard المختلط** خارج هذا الإغلاق؛ لا يصح استنتاج أن Financial RLS صار مسموحاً بسبب نجاح هذا الدليل المحدود.

## المخرجات المرجعية

| الأثر | الحالة |
|---|---|
| Harness مستقل | `scripts/w02-financial-donor-donation-runtime-proof.ts` |
| مدقق exact/fail-closed | `scripts/w02-financial-donor-donation-evidence-validate.mjs` |
| evidence منقحة ومحفوظة 0600 | [ملف evidence][1] |
| نتيجة المدقق | [ملف validation][2] |

[1]: ./evidence/W02-FINANCIAL-DONOR-DONATION-RUNTIME-EVIDENCE.json
[2]: ./evidence/W02-FINANCIAL-DONOR-DONATION-EVIDENCE-VALIDATION.json
