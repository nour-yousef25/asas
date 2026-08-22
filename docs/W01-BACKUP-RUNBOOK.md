# W01 Backup Runbook

هذا الدليل يصف `BACKUP-001` فقط؛ لا ينفذ `BACKUP-002` restore/DR drill الكامل.

| الخطوة | الإجراء | Evidence المطلوب | شرط الفشل الآمن |
|---|---|---|---|
| 1 | استخدم قاعدة التدقيق فقط | environment=`audit-only` | لا تستخدم Production DB |
| 2 | نفذ `pg_dump --format=custom --no-owner --no-privileges` | artifact database dump | توقف عند خطأ dump |
| 3 | أضف configuration summary بلا secrets ثم archive | artifact inventory | لا تضع credentials في artifact summary |
| 4 | شفّر archive بـAES-256-CBC/PBKDF2/SHA-256/salt | encryption evidence | لا ترفع artifact غير مشفر في production policy |
| 5 | ارفع إلى S3-compatible bucket | provider `mc stat` | لا تسجل success قبل upload |
| 6 | نزّل artifact نفسه واحسب SHA-256 | download checksum = upload checksum | حظر update عند اختلاف checksum |
| 7 | أنشئ manifest بوقت `verifiedAt` الناتج من العملية | manifest + ownership + retention | لا hardcode verifiedAt |
| 8 | مرر manifest إلى Health/Update rehearsal | storage/backup checks HEALTHY | Health يبقى DEGRADED عند manifest مفقود/فاشل |

ملكية audit evidence في التنفيذ الحالي `ASAS` وretention `30` يوماً. في Dedicated وSelf-Hosted تتبع ownership responsibility matrix ولا يغير ASAS بنية العميل أو retention دون العقد التشغيلي.
