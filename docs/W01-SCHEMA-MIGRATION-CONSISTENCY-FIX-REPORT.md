# W01 Schema/Migration Consistency Fix Report

**الحالة:** `SCHEMA/MIGRATION CONSISTENCY FIX COMPLETE`  
**نطاق الإصلاح:** `W01-SCHEMA-MIGRATION-CONSISTENCY-FIX` فقط  
**Commit الإصلاح:** `0ead0dc5890848be0aa2b3621b0b2e37b7721bf1`  
**قاعدة التحقق الوحيدة:** `asas_w01_audit` المحلية والمعزولة

> لا يعلن هذا التقرير اكتمال W01. يثبت فقط إزالة مانع توافق Prisma الذي أوقف أدلة W01.

## 1. السبب الجذري

كان **العقد التشغيلي القانوني الحالي** في `prisma/schema.prisma` وPrisma Client والبذر وطبقة المصادقة هو `User.role` من تعداد `Role`. إلا أن migration تاريخية باسم `20260820211156_fix_expense_schema` حذفت العمود `users.role` والتعداد نفسه، ثم أنشأت تمثيلاً تاريخياً مختلفاً هو `users.roleId → roles`.

أعاد Canonical Baseline في W01-0 المصدر إلى نموذج التعداد المدعوم من التطبيق، لكنه لم يحتو migration تقدمية تعكس أثر migration التاريخية عند إنشاء قاعدة بيانات جديدة. لذلك طبقت قاعدة التدقيق كامل التاريخ بنجاح، ولكن فشل البذر عند أول `prisma.user.upsert()` بالخطأ `P2022` لأن العمود `role` غير موجود.

| طبقة الاعتماد | قبل الإصلاح | بعد الإصلاح |
|---|---|---|
| Prisma schema وClient | `User.role: Role enum` | دون تغيير؛ يظل العقد القانوني |
| قاعدة البيانات بعد التاريخ | `users.roleId` فقط | `users.role` و`users.roleId` محفوظان |
| Runtime | يستعمل `user.role` و`Role.*` | متوافق مع قاعدة البيانات |
| Seed | يكتب `Role.SUPER_ADMIN` وغيرها | نجح كاملاً |
| Communications schema | غائب من سجل migrations | يُنشأ تقدمياً ضمن migration التصحيحية |

## 2. الإصلاح الدقيق ولماذا هو صحيح معمارياً

أُضيفت migration واحدة فقط: `20260822060000_align_canonical_schema_non_destructive`. وهي **Forward-only** ولا تعدل أي migration تاريخية ولا تستخدم `DROP TABLE` أو `DROP COLUMN` أو `DROP TYPE`.

تُنشئ migration تعدادات وقنوات الاتصال الناقصة، وتضيف `users.role` من جديد، وتحاول نقل قيمة الدور من جدول `roles` التاريخي عندما تكون قيمته ضمن التعداد القانوني، ثم تستخدم `MEMBER` كقيمة آمنة للحالات غير المعينة. كما تضيف `members.endDate` وتنقل القيمة من `membershipExpiryDate` دون حذف الحقل التاريخي. وتحافظ صراحةً على `users.roleId` و`roles` و`role_permissions` والعلاقات القديمة لأن حذفها عملية مدمرة خارج نطاق هذا الإصلاح.

> أبقى فحص `migrate diff` النهائي ستة عمليات حذف مقترحة فقط تخص هذه البقايا التاريخية المحفوظة عمداً؛ لا توجد فجوات schema قانونية أو فهارس أو جداول تشغيلية مفقودة بعد الإصلاح.

## 3. الملفات وmigrations المتأثرة

| النوع | الملف | التغيير |
|---|---|---|
| Migration جديدة | `prisma/migrations/20260822060000_align_canonical_schema_non_destructive/migration.sql` | مواءمة تقدمية غير مدمرة بين التاريخ والـschema القانونية. |
| اختبار | `src/__tests__/schema-migration-consistency.test.ts` | يثبت عقد enum role وعدم وجود أوامر إسقاط في migration. |
| تحقيق | `docs/W01-SCHEMA-MIGRATION-CONSISTENCY-INVESTIGATION.md` | خريطة اعتماد والسبب الجذري وقرار المسار. |
| متابعة | `todo.md` | توثيق إكمال عناصر نطاق الإصلاح. |

لم تُعدّل migrations التاريخية `20260818134914_add_indexes_and_constraints` أو `20260820211156_fix_expense_schema` أو `20260822054000_w01_installation_state`.

## 4. حالة قاعدة البيانات: قبل وبعد

| القياس | قبل الإصلاح | بعد إعادة الإنشاء من الصفر |
|---|---|---|
| migrations المطبقة | 3 | 4 |
| `users.role` | غير موجود | موجود ويحتوي قيمة enum |
| `users.roleId` | موجود | محفوظ عمداً للتوافق التاريخي |
| Prisma Client | يولّد من schema لكن لا يطابق DB | توليد ناجح ومتوافق مع DB |
| seed | فشل بـ`P2022` | نجح كاملاً |
| admin التجريبي | غير قابل للاستخدام بعد seed الفاشل | `admin@asas.sa` بدور `SUPER_ADMIN` |
| جداول الاتصال الأساسية | مفقودة من تاريخ قاعدة جديدة | 3 من 3 جداول عينة متحققة |

## 5. أدلة الاختبار والتحقق

| الفحص | النتيجة | الدليل |
|---|---:|---|
| تطبيق التاريخ من الصفر | ناجح | 4 migrations طبقت على `asas_w01_audit` |
| Prisma Generate | ناجح | Prisma Client `6.19.3` |
| Prisma Validate | ناجح | `The schema ... is valid` |
| Prisma migrate status | ناجح | `Database schema is up to date` |
| Seed الرسمي | ناجح | اكتمل البذر وأنشأ الحسابات التجريبية |
| فحص توافق migration | ناجح | اختبار ثابت يرفض أوامر الإسقاط |
| Jest كامل | ناجح | 10 suites / 69 tests |
| TypeScript | ناجح | `npx tsc --noEmit` بلا أخطاء |
| فحص مركز الاتصال | ناجح | تشفير وحراسة تحريرية وتوقيع TikTok |
| Production Build | ناجح | Next.js 16.3.1 أكمل التجميع والأنواع وتوليد الصفحات |
| Smoke Test | ناجح | login `200`، تسجيل دخول admin `302`، session بدور `SUPER_ADMIN`، home `200`، health مصرح `200` |
| تدقيق المراجع | ناجح | لا مراجع runtime لـ`roleId` داخل `src`؛ المراجع الباقية مقتصرة على اختبار الحماية والتاريخ المحفوظ |

يظهر Health Center حالة `DEGRADED` في Smoke Test لأن Redis وObject Storage ونسخة احتياطية موثقة لم تُضبط في بيئة الاختبار الذاتية؛ كانت قاعدة البيانات والتطبيق والأمن والذاكرة والقرص بحالة `HEALTHY`. هذا السلوك شفاف ومقصود ولا يمثل نجاحاً زائفاً.

## 6. المخاطر المتبقية

يبقى تحذير Prisma حول `package.json#prisma` المتقادم، وتحذير Next.js حول تسمية `middleware`، وتحذير BullMQ الاختياري حول `@valkey/valkey-glide`. لم تمنع هذه التحذيرات البذر أو الاختبارات أو build، لكنها تسجل كديون تشغيلية منفصلة ولا يعالجها هذا النطاق.

كما تبقى الجداول وعلاقات `roleId` التاريخية في قاعدة البيانات عمداً. لا تستهلكها طبقة runtime، ولا يجوز حذفها أو تنفيذ migration contract عليها قبل خطة ترحيل بيانات معتمدة واختبار نسخ احتياطي واستعادة.

## 7. القرار

**اكتمل W01-SCHEMA-MIGRATION-CONSISTENCY-FIX.** تمت إزالة المانع الذي أوقف قاعدة التدقيق والبذر وSmoke Test، ويمكن الآن **استئناف أدلة W01 المتوقفة** من دون إعلان أن W01 مكتملة تلقائياً. لا تبدأ W02 بموجب هذا التقرير.
