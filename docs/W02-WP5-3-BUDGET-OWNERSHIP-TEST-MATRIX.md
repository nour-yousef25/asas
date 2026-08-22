# W02 WP5-3 — Budget Ownership Test Matrix

| الاختبار | الدليل المطلوب |
|---|---|
| Clean migration | الأعمدة/FKs/indexes في قاعدة تدقيق نظيفة | PASS |
| Upgrade migration | قاعدة حتى WP5-2 ثم migration الجديدة بلا drift | PASS |
| Analyze valid A/B graph | Budget roots mapped؛ item/expense inherited؛ blockers صفر | PASS: total=6, mapped=2 |
| Apply valid A/B graph | row counts ثابتة وowners متسقون | PASS: updated=6, nulls=0 |
| Unmapped Budget | منع apply وبقاء كل owners NULL | PASS |
| Duplicate/multi-owner manifest | `ambiguous` ومنع apply | PASS |
| Invalid org mapping | `invalidReference` ومنع apply | PASS |
| Missing Budget parent | `orphan` ومنع apply | PASS through graph detector |
| Expense بلا BudgetItem | `orphan` ومنع apply | PASS |
| Parent/child owner conflict | `conflict` ومنع apply | PASS |
| Failure injection | rollback كامل بلا assignment جزئي | PASS |
| Foreign keys/counts | counts قبل/بعد متساوية وFKs صالحة | PASS |
| Regression | validate/generate/TypeScript/Jest/communications/build | PASS |

> لا يغطي هذا الاختبار تحويل Reports/Exports أو RLS أو URLs موقعة؛ هذه خارج الحزمة المعتمدة.
