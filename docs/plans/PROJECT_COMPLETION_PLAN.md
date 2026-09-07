# asasnew - خطة إكمال المشروع إلى الرؤية العالمية

## مقدمة
هذه الوثيقة تمثل خطة عمل تفصيلية ومرحلية لإكمال مشروع "أساس" من وضعه الحالي إلى تحقيق الرؤية العالمية الكاملة. الخطة تبدأ من استكمال المرحلة الثانية وتغطي جميع الوحدات والميزات المتبقية حتى المرحلة الرابعة، مع التركيز على الجودة، القابلية للتوسع، وسهولة الصيانة.

## منهجية العمل: تطبيق فصل الاهتمامات (Separation of Concerns)
لتحقيق خطة "علمية وحقيقية"، يجب معالجة الملاحظة الهيكلية الخاصة بغياب مجلد `src/modules/`. **كل المهام المستقبلية في هذه الخطة ستتبع المنهجية التالية بدقة:**

1.  **البيانات (Data Layer - `prisma`):**
    -   التعريف: `schema.prisma` هو مصدر الحقيقة لهيكل البيانات.
    -   المهمة: أي تغيير في البيانات يبدأ من هنا.

2.  **منطق الأعمال (Business Logic Layer - `src/modules/{feature}`):**
    -   التعريف: قلب النظام. يحتوي على كل العمليات الحسابية، قواعد التحقق، والمنطق المعقد للتفاعل مع قاعدة البيانات.
    -   المهمة: يجب أن يكون هذا الجزء مستقلاً تماماً عن واجهة المستخدم (React) وواجهة الـ API (Next.js). يتم إنشاؤه كملفات TypeScript عادية.
    -   مثال: `src/modules/donations/processDonation.ts`

3.  **واجهة الـ API (API Layer - `src/app/api/...`):**
    -   التعريف: مجرد واجهة رقيقة (thin layer) وممر آمن لمنطق الأعمال.
    -   المهمة: استقبال الطلبات، التحقق من الصلاحيات الأساسية، استدعاء الوظائف من `src/modules`, وإرجاع الاستجابة. **يُمنع منعاً باتاً كتابة منطق أعمال هنا.**

4.  **واجهة المستخدم (Presentation Layer - `src/app/(dashboard)`):**
    -   التعريف: المكونات والصفحات التي يراها المستخدم.
    -   المهمة: استدعاء الـ API (عبر Server Actions أو `fetch`)، عرض البيانات، وجمع المدخلات من المستخدم. **يجب أن تحتوي على الحد الأدنى من المنطق البرمجي.**

---

## المرحلة 2 (استكمال): الوحدات الإدارية الأساسية

### 1. بناء وحدة الأنظمة والتعليمات (`content`)
-   **الهدف:** تمكين الإدارة من إنشاء صفحات محتوى ديناميكية.
-   **المهام:**
    -   [ ] **البيانات:** التأكد من أن جدول `ContentPage` في `schema.prisma` مناسب ويحتوي على حقول (title, content, category, slug).
    -   [ ] **منطق الأعمال:** إنشاء `src/modules/content/pages.ts` بالوظائف: `createPage`, `updatePage`, `getPageBySlug`, `getAllPages`.
    -   [ ] **الـ API:** إنشاء `src/app/api/content/pages/route.ts` و `.../[id]/route.ts`.
    -   [ ] **الواجهة:**
        -   [ ] إنشاء `src/app/(dashboard)/content/page.tsx` لعرض جميع الصفحات في جدول بيانات (`data-table`).
        -   [ ] إنشاء `src/app/(dashboard)/content/new/page.tsx` لإضافة صفحة جديدة، مع استخدام محرر نصوص غني (Rich Text Editor).
        -   [ ] إنشاء `src/app/(dashboard)/content/[id]/edit/page.tsx` للتعديل.

### 2. استكمال وحدة الأعضاء (`members`)
-   **الهدف:** إدارة دورة حياة العضوية بشكل كامل.
-   **المهام:**
    -   [ ] **البيانات:** إضافة حقل `membershipExpiryDate` و `status` (Active, Expired, Pending) إلى جدول `Member` في `schema.prisma`.
    -   [ ] **منطق الأعمال:** إنشاء `src/modules/members/renewal.ts` للتعامل مع منطق تجديد العضوية وتغيير الحالة.
    -   [ ] **الواجهة:** إنشاء صفحة `src/app/(dashboard)/members/renew/page.tsx` تحتوي على نموذج لتجديد العضوية.

### 3. استكمال وحدة المتطوعين (`volunteers`)
-   **الهدف:** تتبع أنشطة وساعات التطوع.
-   **المهام:**
    -   [ ] **البيانات:** إنشاء جدول `VolunteerActivity` في `schema.prisma` مرتبط بالمتطوع والفعالية (إن وجدت) مع حقول (description, hours, date).
    -   [ ] **منطق الأعمال:** إنشاء `src/modules/volunteers/activities.ts` لإدارة أنشطة المتطوعين.
    -   [ ] **الـ API:** إنشاء `src/app/api/volunteers/[id]/activities/route.ts`.
    -   [ ] **الواجهة:** إنشاء `src/app/(dashboard)/volunteers/[id]/activities/page.tsx` لعرض وتسجيل أنشطة متطوع معين.

---

## المرحلة 3: المالية، الفعاليات، والتقارير

### 1. بناء وحدة الشؤون المالية (`finance`)
-   **الهدف:** توفير نظام مالي متكامل لإدارة الميزانيات والمصروفات.
-   **المهام:**
    -   [ ] **إدارة الميزانية (`Budget`):**
        -   [ ] **البيانات:** إنشاء جدول `Budget` و `BudgetItem` في `schema.prisma`.
        -   [ ] **منطق الأعمال:** `src/modules/finance/budget.ts`.
        -   [ ] **الـ API:** `src/app/api/finance/budget/route.ts`.
        -   [ ] **الواجهة:** `src/app/(dashboard)/finance/budget/page.tsx`.
    -   [ ] **إدارة المصروفات (`Expenses`):**
        -   [ ] **البيانات:** إنشاء جدول `Expense` مرتبط بـ `BudgetItem`.
        -   [ ] **منطق الأعمال:** `src/modules/finance/expenses.ts`.
        -   [ ] **الـ API:** `src/app/api/finance/expenses/route.ts`.
        -   [ ] **الواجهة:** `src/app/(dashboard)/finance/expenses/page.tsx`.

### 2. بناء وحدة إدارة الفعاليات (`events`)
-   **الهدف:** إدارة الفعاليات وتسجيل الحضور.
-   **المهام:**
    -   [ ] **البيانات:** إنشاء جدول `Event` و `EventAttendance` في `schema.prisma`.
    -   [ ] **منطق الأعمال:** `src/modules/events/events.ts` و `src/modules/events/attendance.ts`.
    -   [ ] **الـ API:** `src/app/api/events/route.ts`.
    -   [ ] **الواجهة:**
        -   [ ] `src/app/(dashboard)/events/page.tsx` (إدارة الفعاليات).
        -   [ ] `src/app/(dashboard)/events/[id]/attendance/page.tsx` (تسجيل الحضور).

### 3. بناء وحدة التقارير المتقدمة (`reports`)
-   **الهدف:** توفير رؤى شاملة وتصدير البيانات.
-   **المهام:**
    -   [ ] **منطق الأعمال:** إنشاء `src/modules/reports/generator.ts` بوظائف مثل `generateFinancialReport`, `generateDonationsReport`. هذه الوظائف ستجمع البيانات من وحدات أخرى.
    -   [ ] **الـ API:** `src/app/api/reports/[reportName]/route.ts` لتوليد البيانات.
    -   [ ] **الواجهة:**
        -   [ ] `src/app/(dashboard)/reports/page.tsx` لعرض لوحة اختيار التقارير.
        -   [ ] استخدام مكتبة مثل `Recharts` لعرض الرسوم البيانية ومكتبة `jspdf` و `jspdf-autotable` لتفعيل زر "تصدير كـ PDF".

---

## المرحلة 4: التكاملات، التخصيص، والنشر

### 1. بناء وحدة إدارة المستخدمين والصلاحيات (RBAC)
-   **الهدف:** نظام أمان قوي يتحكم في وصول المستخدمين.
-   **المهام:**
    -   [ ] **البيانات:** إنشاء جداول `Role`, `Permission`, و `RolePermission` في `schema.prisma`.
    -   [ ] **منطق الأعمال:** `src/modules/users/roles.ts` و `src/modules/users/permissions.ts`.
    -   [ ] **الواجهة:** `src/app/(dashboard)/users/roles/page.tsx` لإنشاء الأدوار وتحديد صلاحياتها.
    -   [ ] **التطبيق:** تحديث `src/middleware.ts` و `src/lib/auth.ts` للتحقق من الصلاحيات قبل السماح بالوصول للصفحات أو الـ API.

### 2. تنفيذ التكاملات الخارجية (`integrations`)
-   **الهدف:** ربط النظام بالخدمات الخارجية الحيوية.
-   **المهام:**
    -   [ ] **تكامل ZATCA (الفاتورة الإلكترونية):**
        -   [ ] **منطق الأعمال:** إنشاء `src/modules/integrations/zatca.ts` ليقوم بتوليد XML للفاتورة، وحساب الـ Hash، وتوليد QR Code (base64 string).
        -   [ ] **التكامل:** استدعاء هذا المودول من `src/modules/donations/` عند إنشاء تبرع جديد لربط الفاتورة بالتبرع.
    -   [ ] **تكامل بوابات الدفع (مثل Moyasar أو PayTabs):**
        -   [ ] **منطق الأعمال:** إنشاء `src/modules/integrations/payment/provider.ts`.
        -   [ ] **الـ API:** `src/app/api/payment/webhook/route.ts` لاستقبال تحديثات حالة الدفع.
    -   [ ] **تكامل رسائل SMS (مثل 4jawaly أو Unifonic):**
        -   [ ] **منطق الأعمال:** `src/modules/integrations/sms.ts` مع وظيفة `sendSms`.

### 3. بناء وحدة إعدادات النظام (`settings`)
-   **الهدف:** تمكين كل جمعية من تخصيص النظام.
-   **المهام:**
    -   [ ] **تخصيص المظهر:**
        -   [ ] **البيانات:** تعديل جدول `Organization` لإضافة حقول (logoUrl, primaryColor, secondaryColor).
        -   [ ] **الواجهة:** `src/app/(dashboard)/settings/appearance/page.tsx`.
        -   [ ] **التطبيق:** حقن هذه الإعدادات في `layout.tsx` لتغيير مظهر النظام ديناميكياً.
    -   [ ] **إدارة القوائم:**
        -   [ ] **البيانات:** إنشاء جدول `MenuItem`.
        -   [ ] **الواجهة:** `src/app/(dashboard)/settings/menus/page.tsx` لواجهة السحب والإفلات (Drag and Drop) لترتيب القوائم.

### 4. النشر والتشغيل (`Deployment`)
-   **الهدف:** إطلاق نسخة مستقرة من النظام.
-   **المهام:**
    -   [ ] **تحسين الأداء:** مراجعة استعلامات قاعدة البيانات البطيئة وإضافة فهارس (indexes) حسب الحاجة.
    -   [ ] **الأمان:** إجراء فحص أمني شامل، والتأكد من صحة إعدادات `CORS` و `CSRF`.
    -   [ ] **الاختبار:** كتابة اختبارات آلية (Unit Tests and Integration Tests) للوحدات الحرجة في `src/modules/`.
    -   [ ] **التوثيق:** تحديث `README.md` بدليل النشر والتشغيل.
    -   [ ] **النشر:** بناء `Docker image` نهائية ونشرها.

---
## خاتمة
هذه الخطة تمثل خارطة طريق هندسية وليست مجرد قائمة مهام. الالتزام بالهيكلية المقترحة سيضمن بناء منتج عالمي، قوي، ومستدام.
