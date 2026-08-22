# W01 Production Security Register

**حالة هذا السجل:** مفتوح قبل أي Production deployment. لا يتغير أي dependency ضمن تنفيذ W01 الحالي.

| المصدر | الشدة | المكون | الأثر المعلن | القرار |
|---|---|---|---|---|
| `npm audit --omit=dev` | High | `deepmerge-ts` عبر Prisma chain | stack exhaustion عند recursive graphs؛ GHSA-ggr8-5vv4-36mx | نطاق مستقل: Dependency Security Remediation |
| `npm audit --omit=dev` | High | `@prisma/config` / `prisma` | يرث advisory أعلاه؛ إصلاح npm المقترح major | لا ترقية تلقائية |
| `npm audit --omit=dev` | High | `xlsx` | prototype pollution GHSA-4r6h-8v6p-xvw6 وReDoS GHSA-5pgg-2g8v-p4x9 | triage واستبدال/mitigation مستقل |
| Build | Warning | BullMQ optional `@valkey/valkey-glide` | لم يمنع ioredis path أو Harness الحقيقي | لا تخف التحذير؛ راقب compatibility |
| Build | Warning | Next middleware convention / Edge `process.cwd` | deprecation/compatibility follow-up | نطاق مستقل قبل production target |
| Tooling | Warning | Prisma `package.json#prisma` | deprecated قبل Prisma 7 | migrate config في نطاق مستقل |

هذا السجل لا يلغي قرار **W01 COMPLETE — TECHNICAL FOUNDATION CLOSED**، لكنه يمنع الادعاء بأن هذه النتيجة تفويض بنشر Production.
