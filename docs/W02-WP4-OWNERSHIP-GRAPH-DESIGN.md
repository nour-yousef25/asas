# W02 WP4 — Ownership Graph Backfill Design

## القرار

يمثل manifest الصريح مصدر ownership الوحيد. لا يعد `organizationId = NULL` في legacy parent orphan، إذ إن هذا هو الوضع المتوقع مباشرة بعد توسعة WP4. تستعمل علاقات Donation إلى Donor وDonationCampaign وProject للتحقق من وجود الرسم البياني واتساق owners المعرفة في manifest فقط؛ ولا تستنتج المنظمة من User أو من أول منظمة أو من قيمة افتراضية.

## Analyze

يبني التحليل index للـmanifest. لكل Donation، يتطلب وجود mapping واحد للـDonation ولكل parent relation غير null. يعد parent ID غير الموجود فعلياً `ORPHAN_RECORD`، والـparent بلا manifest `UNMAPPED_RECORD`، وتعارض owners في manifest `CONFLICTING_PARENT_ORGANIZATION`. يبقى فحص existing `organizationId` بعد WP4 كحاجز إضافي: value غير موجودة orphan وقيمة تخالف manifest conflict.

| حالة Donation graph | القرار |
|---|---|
| Donation وDonor/Campaign/Project جميعها mapped إلى A | PASS |
| Donation A وparent B | Conflict؛ لا كتابة |
| parent موجود بلا manifest | Unmapped؛ لا كتابة |
| parent ID يشير إلى سجل مفقود | Orphan؛ لا كتابة |
| parent relation null | لا يفرض parent غير موجود؛ manifest Donation مطلوب دائماً |

## Apply

بعد analyze بلا blockers، يرتب التطبيق mappings حتمياً: `donors` ثم `donation_campaigns` ثم `projects` ثم `donations` ثم بقية root tables حسب ترتيب ثابت. يجري re-analysis ثم كل update وaudit في transaction واحدة. هذا يسمح بحالة pre-WP4 التي يكون فيها parent وchild بلا owner تاريخي، من دون قبول أي graph متعارض.

## الحدود

لا يغير هذا الإصلاح migrations أو schema أو WP5، ولا يعيد تشغيل Upgrade Rehearsal. يُثبت فقط العقد الجديد وحالاته الإيجابية والسلبية على قاعدة تدقيق.
