# متابعة تنفيذ W01 — ASAS Plus

- [ ] استخراج جميع الميزات المصنفة `Wave = W01` من Master Feature Inventory v1.1 وربطها بالـADRs وWave Mapping.
- [ ] تدقيق بنية Canonical Baseline الحالية وتحديد نقاط التوسع الفعلية دون إنشاء معمارية موازية.
- [ ] تنفيذ `FND-001` وفق تعريفه المعتمد، مع اختبارات وعقد استخدام قابل لإعادة الاستعمال.
- [ ] تنفيذ `FND-002` وفق تعريفه المعتمد، مع توثيق وعقد تكوين آمن.
- [ ] تنفيذ `OBS-001` للمراقبة والسجلات الآمنة والارتباط التشخيصي حسب التعريف المعتمد.
- [ ] تنفيذ `DEP-001` و`DEP-002` لدعم Cloud وDedicated وSelf-Hosted من نواة واحدة.
- [ ] تنفيذ `INST-001` و`INST-002` كأساس مثبت حقيقي دون قفز إلى المثبت التجاري الكامل.
- [ ] تنفيذ `UPDATE-001` و`UPDATE-002` كأساس تحديث آمن وقابل للتدقيق.
- [ ] تنفيذ `BACKUP-001` كأساس نسخ احتياطي واستعادة قابل للاختبار.
- [ ] تنفيذ `HEALTH-001` بفئات HEALTHY وDEGRADED وUNAVAILABLE وNOT_CONFIGURED.
- [ ] إضافة اختبارات W01 وتشغيل فحص الأنواع والبناء وحزمة الاختبارات.
- [ ] إصدار تقرير إكمال W01، وإنشاء commit ورفع الفرع للمراجعة دون تنفيذ أي عناصر من W02 وما بعدها.

## W01-SCHEMA-MIGRATION-CONSISTENCY-FIX

- [x] إعداد Dependency Map كامل لمسار `Schema → Migration → Database → Prisma Client → Seed → Application` للكيانات `User` و`Role`.
- [x] فحص تاريخ Git ومقارنة `User.role` و`User.roleId` وتحديد التصميم النهائي المدعوم بالأدلة.
- [x] توثيق Root Cause قبل تغيير أي migration أو schema أو عقد تطبيق.
- [x] اختيار Forward Migration محدود وغير مدمر بعد إثبات عدم تطابق schema الحالية مع التاريخ القانوني للمigrations.
- [x] إصلاح أقل طبقة لازمة عبر migration تقدمية دون إعادة كتابة migrations تاريخية أو تغيير عقد التطبيق القانوني.
- [x] إعادة إنشاء قاعدة التدقيق `asas_w01_audit` فقط وتطبيق جميع migrations من الصفر.
- [x] التحقق من Prisma Client وDatabase Schema والبذر الرسمي وSmoke Test على قاعدة التدقيق.
- [x] تدقيق جميع مراجع `role` و`roleId` وتشغيل الاختبارات وTypeScript وبناء الإنتاج.
- [ ] إصدار تقرير `W01 Schema/Migration Consistency Fix Report` وإنشاء commit منفصل واضح للمراجعة.
