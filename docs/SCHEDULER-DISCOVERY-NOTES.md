# Domain Scheduler — Discovery Notes

## الحالة الأولية

العقد البرمجي الحالي في `src/lib/domain-scheduler.ts` ليس scheduler مفعلاً في runtime. إنه يفرض catalogue versioned، مفاتيح فريدة وموافقاً عليها، tenant mode، interval/timeout/retry/concurrency محدودة، idempotency مشتق من job/organization/scheduled time، ورفض executor الغائب. لا يوجد في هذا العقد وحده catalogue تشغيل معتمد أو persistent run store أو tenant executor عام.

تشير وثائق المشروع الحالية إلى أن worker التشغيلي المثبت هو worker نشر اتصالات tenant-bound، بينما Domain Scheduler ما زال contract/dry-run. توجد آلية retention backup مستقلة عبر systemd timer وليست job ضمن Domain Scheduler؛ لا يعاد تصنيفها أو تشغيلها في هذه البوابة.

## catalogue وheartbeat الموجودان

يوثق `SCHEDULER-CATALOGUE-54.md` سبع surfaces فقط: worker نشر الاتصالات tenant-bound، retention timer مستقل، عقد Domain Scheduler، وثلاثة مسارات معطلة تحتاج provider أو owner policy، وتقارير غير مطبقة. ويؤكد أن جولة dry-run أقدم أثبتت parser وtenant identifier guard فقط، لا tenant authority checkout ولا side effect.

يعتمد health contract على heartbeat JSON versioned يحوي catalogue version ووقت heartbeat وrun identifier. يرفض الملف إن لم يكن regular file أو كانت صلاحياته world-accessible أو group-writable، ويرفض lag حين يتجاوز الوقت عتبة عددية موجبة محددة صراحة. لا يعد غياب المسار أو العتبة نجاحاً؛ يعيد `UNCONFIGURED`.

## worker والـqueue

الـworker النشط ليس scheduler عاماً. `tenant-publication-supervisor` يطلب directory credentials خاصاً بالـqueue، ينشئ worker منفصلاً لكل organization له principal نشط، ويستخدم tenant-bound executor. لا يملك global queue fallback؛ absence of provisioning هو idle state مقصود. يكتب heartbeat ذي TTL في Redis ويزيله عند الإيقاف. أما communications worker القديم فيرمي خطأ quarantine مقصوداً ولا يمكن تشغيله.

هذا يثبت أن وظيفة publication القائمة يجب أن تبقى خارج أي executor عام جديد وأن أي catalogue dry-run لا يحق له تمرير `organizationId` كبديل عن checkout authority.

## حدود هذه الجولة

لا تشغّل أي وظيفة حية أو external egress أو email أو payment. أي job يحتاج provider أو public endpoint أو credential أو production approval يظل disabled ومصنفاً `EXTERNAL_INPUT_REQUIRED` أو `BLOCKED` حسب الدليل. لا تكون أي نتيجة `PASS` إلا للـcatalogue/harness المقيد الذي لا يملك executor side effect.
