# W02-WP5-3 — Report Generation Closure Matrix

| Requirement | Implementation | Test | Evidence | Result | Commit | Remaining Risk |
|---|---|---|---|---|---|---|
| TenantContext server-side | `requireTenantContext` في report route | A/B contexts في harness | harness PASS | PASS | `139044d` | يعتمد على auth session مثل بقية routes |
| `report.generate` policy | `requirePermission` داخل service | allow/explicit deny/stale policy | harness PASS | PASS | `139044d` | purpose/classification runtime غير موجودين؛ gap مسجل بلا اختراع W07 |
| Financial ownership | scoped Budget/Item/Expense queries | A/B totals + category/date/budget filter | 1000/160 مقابل 2000/390 | PASS | `139044d` | owner columns nullable تاريخياً؛ WP5-3 foundation/backfill شرط مسبق |
| Donations ownership | scoped Donation roots وscoped relation lookups | A/B totals + foreign donor/campaign/project | 200 مقابل 880 + denies | PASS | `139044d` | لا تحويل لتقرير Beneficiary لعدم وجود route فعلي |
| Client tenant spoofing | لا parse لـorganizationId authority | `organizationId=B` | A-only result | PASS | `139044d` | client IDs تبقى resource IDs وتتحقق scoped |
| IDOR/foreign filters | `assertScopedResource` + 404 mapping | foreign budget/donation/donor/campaign/project | five scope denials | PASS | `139044d` | لا report relation جديدة في النطاق |
| Input safety | allow-list/validation | malformed date/page، search/paging/sort | harness PASS | PASS | `139044d` | report filter surface محدود للنطاق الحالي |
| Audit redaction | allow/deny `AuditLog` metadata فقط | audit content inspection | 8 scoped rows، بلا fixture names | PASS | `139044d` | Audit v2 ليس ضمن النطاق |
| No export delivery | explicit 501 لـexport/download/format/share؛ لا generator file | route contract + static source audit | no jsPDF/local Prisma/file output | PASS | `139044d` | `report.export` deferred إلى governance/delivery contract |
| Runtime isolation | independent PostgreSQL database، لا mocks | two-org harness | run status PASS | PASS | `139044d` | لا RLS في هذه المرحلة بتفويض صريح |
| Regression | validate/generate/tsc/Jest/communications/build | full command suite | all exit 0; Jest 71 passed, 1 suite skipped existing | PASS | `139044d` | warnings موثقة في final report |
| Scope boundary | no schema/migration/RLS/queue/cache/storage/WP5-4+ | git/statics review | no such implementation introduced | PASS | `139044d` | export governance وReportShare ownership ما زالا deferred |
