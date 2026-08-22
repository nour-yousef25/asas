# W02 WP4 — Backfill Contract Design

**الحالة:** Proposed implementation contract for `W02-WP4-BACKFILL-CONTRACT-FIX`.

## القرار

يعتمد الإصلاح **manifest صريحاً لكل سجل**، بدلاً من الاستنتاج من علاقات legacy أو تمرير منظمة واحدة. هذا هو أصغر تصميم يظل آمناً: ثمانية من root aggregates العشرة لا تملك مصدراً موثوقاً دائماً للملكية، بينما وجود `userId` أو relation إلى parent لا يكفي لحسم منظمة مستخدم متعدد العضويات. لا تُنشأ migration جديدة لأن WP4 أضافت الحقول اللازمة، والمشكلة محصورة في عقد التشغيل.

## العقد

يمر المشغل قائمة entries تحوي `table` و`recordId` و`organizationId` و`source` و`reason` اختيارياً. مرحلة `analyze` تقرأ فقط، وتبني تقريراً لكل جدول وللناتج العام. ترفض مرحلة `apply` قبل أي كتابة إذا كان أي من `unmapped` أو`orphan` أو`ambiguous` أو`conflict` أو`unexpectedNull` أو`invalidReference` أكبر من صفر. كل assignment يحتاج entry واحداً فقط وسجل/منظمة موجودين، ولا تقبل السجلات ذات `organizationId` الحالي المختلف.

| الحالة | النتيجة | كتابة |
|---|---|---|
| Entry وحيد، سجل موجود، منظمة موجودة، بلا owner حالي | mapped | مسموحة فقط عند نجاح التقرير بالكامل |
| لا entry لسجل nullable | unmapped | ممنوعة |
| entry مكرر بسجل/منظمات متعددة | ambiguous | ممنوعة |
| entry يحدد منظمة غير موجودة | invalidReference | ممنوعة |
| السجل يحمل owner موجوداً يخالف entry | conflict | ممنوعة |
| السجل يحمل owner غير موجود | orphan | ممنوعة |

## الذرية والتدقيق

تعمل apply داخل `prisma.$transaction`، وتعيد تحليل الحالة داخل المعاملة قبل التحديث، ثم تحدث الصفوف المحددة فقط وتسجل حدث audit واحداً. لا يوجد fallback أو skip صامت. يؤجل اشتقاق ownership من parent relations إلى work package منفصل؛ لا يصح اختراعه دون source data موثوق.

## الحدود

لا يطبق هذا التصميم upgrade rehearsal ولا يغير migrations أو WP5. Harness التدقيقي سيُثبت A/B ورفض B→A وunmapped/orphan/ambiguous/conflict/invalid-reference وrollback عند failure.
