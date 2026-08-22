# W02 WP5-0 — Scope Matrix

| Area | Inventory evidence | Tenant-safe now | Planned phase | Gate before next phase |
|---|---:|---|---|---|
| TenantContext endpoints | 2 routes | partial/kernel only | WP5-1 | stale/inactive/switch tests |
| API routes | 44 routes | no | WP5-3 | full route inventory classification |
| Direct Prisma in API | 27 routes | no | WP5-2/3 | no sensitive route-to-Prisma path |
| Repositories | 1 generic contract | no domain conversion | WP5-2 | scoped methods per high-risk domain |
| Beneficiary/Documents | high | no | WP5-4 first | CRUD/IDOR/nested tests |
| Donor/Donation | high | no | WP5-4 second | parent ownership/financial isolation |
| Reports/Exports | high | no | WP5-4 | tenant-bound generator/export |
| Jobs/queues/cache | 192 candidate files | unknown | WP5-5 | envelope and namespace evidence |
| RLS | none operational | no | WP5-6/7 | non-owner shadow/direct SQL evidence |
| Files/storage | upload/file routes | no | WP5 inventory only | WP6 storage contract dependency |

> هذا التقرير لا يجيز WP5-1. المرحلة التالية تتطلب تفويضاً مستقلاً وفق التوجيه المعتمد.
