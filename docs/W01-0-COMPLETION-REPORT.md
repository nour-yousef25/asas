# تقرير إكمال W01-0 — تثبيت المصدر القانوني والبناء

**التاريخ:** 21 أغسطس 2026  
**النطاق المنفذ:** W01-0 فقط، بوصفه بوابة حماية قبل بدء W01.  
**الفرع:** `w01-0-canonical-baseline`  
**Commit المصدر القانوني:** `909b638ee942a2c6dbf1ba331767c193dd63303e`  
**قرار الجاهزية:** **نعم، المنصة جاهزة لدخول W01 التطويري.** لا تُعد هذه النتيجة تصريحاً بالنشر الإنتاجي قبل إغلاق المخاطر الأمنية والتشغيلية المسجلة أدناه.

> يثبت هذا التقرير استقرار المصدر والبناء والاختبارات ضمن W01-0. ولا ينفذ أي Installer كامل أو License Management أو Multi-Tenant Migration أو Nafath Connector أو ميزة مجال جديدة.

## 1. خلاصة تنفيذ البوابة

تم توحيد العمل على نسخة GitHub في الفرع القانوني المشار إليه أعلاه، مع دمج التغييرات المحلية المصنفة سابقاً وفق KEEP / MERGE / DISCARD بدلاً من استبدالها عشوائياً. أزيلت عوائق TypeScript الفعلية، ووُحّدت عقود Prisma وZod وواجهات النماذج، وأعيدت وحدات مركز الاتصال ذات الصلة. كما أصبح بناء Next.js مستقلاً عن اتصال قاعدة البيانات في وقت البناء؛ إذ إن قطاع لوحة التحكم يحتاج جلسة وسياق مؤسسة وقاعدة بيانات في وقت الطلب، ولذلك صار ديناميكياً بدلاً من محاولة prerender غير آمنة.

| المؤشر | النتيجة | الدليل |
|---|---|---|
| المصدر القانوني | مكتمل | الفرع `w01-0-canonical-baseline` وcommit `909b638` |
| فحص TypeScript المباشر | ناجح | `npx tsc --noEmit --pretty false` بلا مخرجات أخطاء |
| بناء Next.js الإنتاجي | ناجح | `npm run build` أكمل التجميع وفحص الأنواع و31 صفحة ثابتة |
| اختبارات Jest | ناجحة | 4 suites، 47 اختباراً ناجحاً |
| فحوصات مركز الاتصال | ناجحة | التشفير وحارس المحتوى وتوقيع TikTok |
| عقد البيئة | مضاف ومختبر بنيوياً | `npm run check:env` مع مدخلات اختبار غير تشغيلية |

## 2. دليل البناء والاختبار

نجح الأمر `npm run build` في نسخة التدقيق بعد إتمام التالي: تجميع Webpack، فحص TypeScript، جمع بيانات الصفحات، وتوليد 31 صفحة ثابتة، ثم إنهاء تحسين الصفحات وتجميع build traces. ولا يستخدم هذا الدليل `ignoreBuildErrors` أو تجاوزاً لفحص الأنواع.

| الأمر | النتيجة | الملاحظة |
|---|---|---|
| `npx tsc --noEmit --pretty false` | ناجح | لا توجد أخطاء TypeScript بعد الإصلاحات |
| `npm run build` | ناجح | فحص الأنواع: 8.6 ثانية؛ توليد الصفحات الثابتة: 31/31 |
| `npm test -- --runInBand` | ناجح | 4 suites، 47 اختباراً؛ يظهر تحذير Jest غير مانع بسبب `.next/standalone/package.json` |
| `npm run test:communications` | ناجح | يختبر AES-256-GCM وحارس المحتوى وتوقيع TikTok |
| `npm run check:env` | ناجح بنيوياً | نُفّذ ببيانات اختبار، وليس بأسرار أو قاعدة إنتاج |

## 3. مصفوفة البيئة والتشغيل

| المجال | العقد المعتمد | حالة التحقق في W01-0 | الملاحظة التشغيلية |
|---|---|---|---|
| Node.js | `v22.13.0` | متحقق | استخدم في البناء والاختبارات |
| Next.js | `16.3.1` بوضع Webpack | متحقق | البناء ناجح |
| Prisma | `6.19.3` | متحقق نوعياً | يولّد العميل ويجتاز فحص الأنواع؛ اتصال قاعدة بيانات تدقيق مستقل لم يُنفذ |
| `DATABASE_URL` | يبدأ بـ `postgresql://` أو `postgres://` | متحقق بنيوياً | مطلوب في التشغيل، ولا يدخل السر في Git |
| `AUTH_SECRET` | 32 محرفاً على الأقل | متحقق بنيوياً | مطلوب في التشغيل |
| `INTEGRATIONS_ENCRYPTION_KEY` | Base64 يفك إلى 32 بايت | متحقق بنيوياً | مطلوب لتشفير بيانات القنوات |
| S3 في الإنتاج | endpoint، access key، secret key، bucket | متحقق بنيوياً | أصبح التخزين يفشل بإيضاح عند غيابها في الإنتاج بدلاً من استخدام بيانات MinIO الافتراضية |
| Redis | اختياري في baseline | غير مطلوب للبناء | تستعمل الطوابير البديل المحلي عند غيابه؛ يجب إعداد Redis في التشغيل متعدد العمال |

> لم تُنسخ أو تُعرض أو تُثبت أي قيمة من ملفات البيئة أو الأسرار ضمن هذا التقرير أو commit المصدر القانوني.

## 4. تقرير التبعيات والأمن

تعتمد النسخة على Next.js 16.3.1، React 19.2.8، Prisma 6.19.3، Zod 4.4.3، React Hook Form 7.86.0، TanStack Table 9.1.2، BullMQ 6.1.2، وXLSX 0.18.5. يُظهر `npm audit --omit=dev` أربع ملاحظات عالية، ولا توجد ملاحظات حرجة.

| البند | المعالجة في W01-0 | الحالة |
|---|---|---|
| عقود API | أضيفت `apiSuccess` و`apiError` و`apiUnauthorized` و`apiInternalError`، ووُحّدت معالجة `ZodError.issues` | مكتمل |
| Prisma | وُحّدت أسماء النماذج والتعدادات وأنواع الإدخال مع المخطط الفعلي | مكتمل |
| Next.js 16 | وُحّدت `params` الديناميكية كـ Promise، وعُزلت لوحة التحكم الديناميكية عن prerender | مكتمل |
| الأسرار | لا توجد ملفات بيئة ضمن التغييرات؛ أضيف فحص عقد البيئة | مكتمل |
| تخزين S3 | أزيلت بيانات الاعتماد الافتراضية من مسار الإنتاج | مكتمل |
| Auth في المظهر | أصبح تحديث إعدادات المظهر يتطلب جلسة، ولا يستخدم معرف مؤسسة عددي ثابت | مكتمل |
| `xlsx` | تدقيق npm يبلّغ عن Prototype Pollution وReDoS عاليَي الخطورة | خطر متبقٍ |
| Prisma / deepmerge-ts | تدقيق npm يبلّغ عن ثلاث ملاحظات عالية مرتبطة بـ Prisma/deepmerge-ts | خطر متبقٍ |

## 5. التغييرات المستعادة من اللقطة المحلية

| القرار | التغييرات | السبب التقني |
|---|---|---|
| KEEP | بنية التطبيق الأساسية من GitHub ومخطط Prisma المدمج | هي الأصل القانوني القابل للتتبع للفرع الموحد |
| MERGE | `crypto.ts` و`types.ts` و`oauth.ts` و`content-guard.ts` ووحدات النشر والموصلات وسجل التدقيق | تكمل مركز الاتصال المعتمد ولا تستبدل بنية المصدر الأساسية |
| MERGE | مسارات OAuth، webhooks، القنوات وخطط النشر وواجهة المركز | تستعيد تكامل مركز الاتصال دون إنشاء مجال جديد خارج inventory المعتمد |
| MERGE | `DataTable` وعقود API وفحص البيئة ونصوص البناء | تعالج عوائق بناء وتشغيل قابلة لإعادة الإنتاج |
| DISCARD | ملفات Prisma وواجهات تاريخية غير تشغيلية من نطاق TypeScript | بقيت محفوظة في Git، لكنها لا تدخل في فحص تطبيق Next.js ولا تحمل عقود المخطط الحالي |

## 6. الإصلاحات الفنية الرئيسة

تمت مواءمة Zod v4 مع `issues` وواجهة `z.record` الجديدة، وضبط TanStack Table 9.1.2 بترتيب معاملات `ColumnDef` الصحيح، وتحويل حمولات الإعلانات وSMS والمهام من كائنات `FormData` المقيدة إلى JSON صريح. كذلك حُذفت محاولات كتابة حقول مشتقة غير موجودة في Prisma، مثل قيمة التحصيل ونسبة إكمال المشروع؛ وتبقى هذه القيم قابلة للاشتقاق من التبرعات عند القراءة بدلاً من تخزين حالة موازية غير موثوقة.

وفي جانب البنية، أصبحت وحدات الفعاليات والميزانيات والمصروفات والأنشطة التطوعية تستخدم أنواع Prisma المولدة من المخطط، كما عُزلت ملفات Prisma التاريخية المتتبعة عن نطاق TypeScript التشغيلي دون حذفها. هذه الإجراءات تعالج سبب فئة الأخطاء بدلاً من إسكاتها عبر `ignoreBuildErrors`.

## 7. جرد الملفات المتغيرة في commit المصدر القانوني

```text
A  docs/digital-communications.md
M  package-lock.json
M  package.json
M  prisma/schema.prisma
A  scripts/build.mjs
A  scripts/check-communications.mjs
A  scripts/check-env.mjs
A  scripts/communications-worker.mjs
A  scripts/create-migration-from-current.mjs
A  scripts/prisma-local.mjs
M  src/app/(dashboard)/announcements/page.tsx
M  src/app/(dashboard)/beneficiaries/[id]/page.tsx
M  src/app/(dashboard)/beneficiaries/import/page.tsx
M  src/app/(dashboard)/content/[id]/edit/page.tsx
M  src/app/(dashboard)/content/_components/columns.tsx
M  src/app/(dashboard)/content/_components/content-page-form.tsx
M  src/app/(dashboard)/donations/invoices/[id]/page.tsx
M  src/app/(dashboard)/donors/[id]/page.tsx
M  src/app/(dashboard)/events/[id]/attendance/page.tsx
M  src/app/(dashboard)/finance/expenses/page.tsx
M  src/app/(dashboard)/layout.tsx
M  src/app/(dashboard)/members/[id]/page.tsx
M  src/app/(dashboard)/news/[id]/edit/page.tsx
M  src/app/(dashboard)/news/[id]/page.tsx
M  src/app/(dashboard)/performance/kpi/[id]/report/page.tsx
M  src/app/(dashboard)/projects/[id]/edit/page.tsx
M  src/app/(dashboard)/projects/[id]/page.tsx
M  src/app/(dashboard)/sms/page.tsx
A  src/app/(dashboard)/surveys/page.tsx
M  src/app/(dashboard)/tasks/page.tsx
M  src/app/(dashboard)/volunteers/[id]/activities/page.tsx
M  src/app/api/beneficiaries/route.ts
A  src/app/api/communications/channels/route.ts
A  src/app/api/communications/plans/route.ts
M  src/app/api/content/pages/[id]/route.ts
M  src/app/api/donations/route.ts
M  src/app/api/events/[id]/attendance/route.ts
M  src/app/api/events/route.ts
M  src/app/api/finance/budget/route.ts
M  src/app/api/finance/expenses/route.ts
A  src/app/api/integrations/[platform]/start/route.ts
M  src/app/api/news/[id]/route.ts
M  src/app/api/news/route.ts
M  src/app/api/projects/[id]/route.ts
M  src/app/api/reports/[reportName]/route.ts
M  src/app/api/settings/appearance/route.ts
M  src/app/api/sms/route.ts
A  src/app/api/surveys/route.ts
M  src/app/api/volunteers/[id]/activities/route.ts
A  src/app/api/webhooks/[platform]/route.ts
A  src/components/communications/hub-client.tsx
M  src/components/layout/sidebar.tsx
A  src/components/platform/ops-ui.tsx
A  src/components/ui/data-table.tsx
M  src/components/ui/form.tsx
M  src/lib/api-response.ts
M  src/lib/auth.ts
A  src/lib/communications/audit.ts
A  src/lib/communications/connectors.ts
A  src/lib/communications/content-guard.ts
A  src/lib/communications/crypto.ts
A  src/lib/communications/editorial-assistant.ts
A  src/lib/communications/oauth.ts
A  src/lib/communications/publisher.ts
A  src/lib/communications/types.ts
A  src/lib/communications/webhooks.ts
M  src/lib/constants.ts
M  src/lib/integrations/payment/index.ts
A  src/lib/organization-context.ts
M  src/lib/pagination.ts
M  src/lib/queue.ts
M  src/lib/rate-limit.ts
M  src/lib/storage.ts
M  src/lib/types.ts
M  src/middleware.ts
M  src/modules/content/pages.ts
M  src/modules/events/attendance.ts
M  src/modules/events/events.ts
M  src/modules/finance/budget.ts
M  src/modules/finance/expenses.ts
M  src/modules/reports/generator.ts
M  src/modules/volunteers/activities.ts
M  tsconfig.json
```

## 8. المخاطر المتبقية وخطة الاحتواء

| الخطورة | الخطر | الأثر | الإجراء المطلوب |
|---|---|---|---|
| عالية | أربع ملاحظات من `npm audit`، بينها ثغرتا `xlsx` وملاحظات Prisma/deepmerge-ts | خطر أمني محتمل عند معالجة ملفات أو رسوميات بيانات غير موثوقة | تقييم ترقية متوافقة وإعادة اختبار الاستيراد قبل النشر الإنتاجي |
| متوسطة | تحذير BullMQ عن `@valkey/valkey-glide` الاختياري | لا يمنع البناء؛ يحتاج قرار runtime عند اختيار عميل Valkey | تثبيت العميل المدعوم أو ضبط BullMQ على عميل Redis المعتمد قبل تفعيل العمال |
| متوسطة | تحذير Edge Runtime من `process.cwd` داخل Next.js | لا يمنع البناء الحالي | مراجعة route/runtime المتأثر عند ترقية Next.js أو تفعيل Edge فعلياً |
| متوسطة | اصطلاح `middleware` deprecated في Next.js 16 | دين تقني ترحيل لاحق | ترحيل مضبوط إلى `proxy` في موجة صيانة مستقلة |
| متوسطة | لا توجد قاعدة بيانات تدقيق مستقلة مزودة في هذا التنفيذ | لم يُجر اختبار CRUD تشغيلي متصل بقاعدة حقيقية | تجهيز `asas_audit` وتشغيل migrations/seed واختبارات smoke قبل النشر |
| منخفضة | تحذير Jest عن تضارب اسم الحزمة داخل `.next/standalone` | لا يمنع 47 اختباراً ناجحاً | عزل `.next` من Haste map في ضبط Jest ضمن تحسين صيانة لاحق |

## 9. القرار النهائي

**قرار W01:** يمكن بدء W01 الآن. أصبح المصدر موحداً وقابلاً للبناء والاختبار بصورة قابلة لإعادة الإنتاج، ولا يوجد حاجز TypeScript أو build يحول دون البدء. يبقى النشر الإنتاجي محجوباً عملياً إلى أن تُغلق ملاحظات تدقيق التبعيات، وتجهز قاعدة بيانات تدقيق منفصلة، وتنفذ اختبارات smoke موصولة بالبيئة الحقيقية.

لا تُنفّذ أي عناصر W01 في هذا التقرير. هذا التقرير يقفل W01-0 فقط ويثبت بوابة الحماية المطلوبة قبل العمل الكبير.
