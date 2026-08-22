# W01 Schema/Migration Consistency — التحقيق والسبب الجذري

## النطاق والحدود

يغطي هذا التحقيق فقط تباعد `Prisma schema` وPrisma Client وسجل migrations الذي ظهر عند تنفيذ البذر على قاعدة التدقيق المعزولة `asas_w01_audit`. لم تُلمس أي قاعدة بيانات إنتاج أو تطوير أو بيانات عميل، ولم تُعدَّل أي migration تاريخية.

## خريطة الاعتماد

| الطبقة | الحالة الفعلية | الدليل | الأثر |
|---|---|---|---|
| Canonical Prisma schema | `User.role` من نوع enum `Role` مع قيمة افتراضية `MEMBER`، ولا يوجد `roleId` أو نموذج `Role` علاقي | `prisma/schema.prisma` | هذا هو العقد الذي يولّد منه Prisma Client الحالي. |
| Prisma Client | يولَّد بنجاح من الـschema القانونية ويعرّف `Role` كتعداد | `npx prisma generate` و`@prisma/client` | تتوقع طبقة التطبيق والـseed الحقل `users.role`. |
| Runtime application | المصادقة والجلسة والتحقق من الصلاحيات وسياق الجمعية تستعمل `user.role` و`Role.*` | `src/lib/auth.ts` و`src/lib/organization-context.ts` | التصميم التشغيلي الجاري هو enum role وليس علاقة `roleId`. |
| Seed | ينشئ مستخدمين بقيم `Role.SUPER_ADMIN` و`Role.EDITOR` وغيرها | `prisma/seed.ts` | يفشل عندما تطبق قاعدة البيانات التاريخية التي لا تحتوي عمود `role`. |
| Historical migration 1 | ينشئ enum `Role` وعمود `users.role` | `20260818134914_add_indexes_and_constraints` | يطابق التصميم التشغيلي الحالي مبدئياً. |
| Historical migration 2 | يحذف `users.role` وenum `Role`، وينشئ `users.roleId` وجدول `roles` | `20260820211156_fix_expense_schema` | يعيد قاعدة البيانات إلى نموذج علاقات لا يطابق الـschema والتطبيق القانونيين. |
| قاعدة التدقيق بعد migrations | قبل الإصلاح: لا يوجد عمود `users.role`، ولذلك أعاد البذر الخطأ `P2022` | `/tmp/asas-w01-audit-migrate.log` و`/tmp/asas-w01-audit-seed.log` | يمنع seed وSmoke Test رغم سلامة build والاختبارات الوحدوية. |

## التحقيق التاريخي

كانت النسخة المستوردة الأولى `c64dc31` تحمل تصميم `User.roleId → Role`. أعاد Commit المصدر القانوني لـW01-0 (`909b638`) الـschema والتطبيق إلى تصميم enum `User.role` — وهو أيضاً ما تعتمد عليه اللقطة المحلية المستعادة — لكنه لم يتضمن migration تقدمية تقلب أثر migration التاريخية الثانية في قواعد البيانات الجديدة.

لا تدخل ملفات الإدارة التاريخية داخل مجلد `prisma/` مثل `prisma/roles.ts` و`prisma/role-form.tsx` في نطاق TypeScript الحالي؛ إذ يحصر `tsconfig.json` الإدخال في `src/**` و`prisma/seed.ts`. كما لم يظهر أي استيراد runtime من `src` لخدمات `roleId`.

## السبب الجذري

> **السبب الجذري هو تباعد زمني بين المصدر القانوني وسجل migrations.**

التصميم النهائي المدعوم بالـschema القانونية وPrisma Client والـseed والتطبيق التشغيلي هو **`User.role: Role enum`**. أما التحويل التاريخي إلى **`User.roleId → roles`** فقد بقي كآخر أثر قاعدة بيانات مطبق بعد أن استبدل W01-0 المصدر القانوني التصميم العلاقي بتعداد الأدوار، من دون إضافة migration تقدمية تعيد توافق قاعدة البيانات.

## مسار الإصلاح الأدنى المقترح

المسار الوحيد المتوافق مع الأدلة هو **Forward Migration جديدة غير مدمرة** بعد التاريخ الحالي. ستعيد إنشاء enum `Role`، وتضيف `users.role` وتحوّل أي ربط تاريخي صالح من `roles.name` إلى قيم التعداد، ثم تضع القيمة الآمنة `MEMBER` للحالات غير المعينة. لن تُحذف migration التاريخية أو جداول `roles` و`role_permissions`، ولن يُستخدم `db push` أو أي عملية إسقاط بيانات.

قبل التطبيق ستُشغّل مقارنة `migrate diff` على قاعدة ظل منفصلة للتحقق من أي فروق تاريخية إضافية مثل حقل العضوية، لأن إصلاح عمود `role` وحده لا يُفترض أنه يعالج كل تباعد محتمل.
