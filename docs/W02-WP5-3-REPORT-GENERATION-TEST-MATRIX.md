# W02 WP5-3 — Report Generation Test Matrix

| الاختبار | Financial | Donations | النتيجة المطلوبة | نتيجة قاعدة التدقيق |
|---|---|---|---|---|
| A sees A / B sees B | totals/rows A أو B فقط | totals/rows A أو B فقط | PASS | PASS: 1000/160 مقابل 2000/390؛ 200 مقابل 880 |
| Broad/empty query | A aggregate فقط | A aggregate فقط | PASS | PASS |
| `organizationId=B` client input | ignored | ignored | PASS | PASS |
| Foreign budget/donor/campaign/project ID | 404 أو empty scoped result | 404 أو empty scoped result | PASS | PASS: `ReportScopeError` لكل identifiers الأجنبية |
| Search/pagination/sorting | A-only | A-only | PASS | PASS |
| Date/category filters | scoped totals | scoped totals | PASS | PASS: Financial A = 160 |
| Malformed filter/report name | 400 | 400 | PASS | PASS: malformed date/pagination؛ route whitelist ثابتة |
| Permission deny/stale policy | no query/result | no query/result | PASS + redacted audit | PASS: explicit deny وstale policy |
| Audit allow | redacted metadata only | redacted metadata only | PASS | PASS: 8 audit rows، بلا أسماء fixture |
| Export/download/artifact | not implemented | not implemented | explicit NOT AVAILABLE | PASS: route يعيد 501 عند `export/download/format/share` |
| Runtime evidence | PostgreSQL A/B fixture | PostgreSQL A/B fixture | no mocks | PASS: `scripts/w02-wp5-3-report-generation-integration.ts` |
