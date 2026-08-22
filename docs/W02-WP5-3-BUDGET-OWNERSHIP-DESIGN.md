# W02 WP5-3 — Budget Ownership Foundation Design

**الحالة:** Contract approved for implementation under the user-authorized Budget Ownership Foundation scope only.

## Ownership Graph

يبني المصدر الحالي graph واحداً لا يقبل التخمين: `Budget` هو root aggregate، و`BudgetItem.budgetId` علاقة إلزامية إلى Budget، و`Expense.budgetItemId` علاقة اختيارية إلى BudgetItem. لذلك يملك Budget فقط `organizationId` مباشر، بينما يرث BudgetItem وExpense الملكية من parent graph؛ يضاف لهما `organizationId` مادي أيضاً للتحقق والاستعلام والكشف عن conflict، ولا يصبحان مصدراً مستقلاً لملكية tenant.

| الكيان | مصدر ownership القانوني | قاعدة الاتساق |
|---|---|---|
| Budget | manifest صريح لكل root record | organization موجودة ووحيدة |
| BudgetItem | Budget parent | `item.organizationId = budget.organizationId` |
| Expense | BudgetItem parent | `expense.organizationId = item.organizationId = budget.organizationId` |

`Expense` بلا `budgetItemId` تعد orphan في هذا العقد وتمنع apply. لا يوجد parent بديل مثبت في schema، لذلك لا تستنتج الأداة tenant من `approvedById` أو invoice URL أو أي client input.

## Migration Contract

تضيف migration forward-only nullable `organizationId` وفهرساً وFK `ON DELETE SET NULL` إلى Budget وBudgetItem وExpense. لا تضيف `NOT NULL` أو uniqueness أو RLS ولا تعدل تاريخ migrations. تبقى الحقول nullable حتى يثبت backfill على بيانات تدقيق ويُعتمد hardening لاحقاً.

## Analyze / Apply Contract

يمر manifest صريحاً يتضمن `{ table: "Budget", recordId, organizationId, source, reason? }` للـBudget roots فقط. `analyze` يبني graph ويعيد counters لـ`mapped`, `unmapped`, `orphan`, `ambiguous`, `conflict`, `invalidReference`, `unexpectedNull`. `apply` يرفض قبل الكتابة إذا كان أي counter حاظر غير صفر، ثم يحدث Budget وBudgetItem وExpense بترتيب root→child داخل transaction واحدة. لا يوجد fallback أو bulk organization.

## Explicit Boundaries

هذه الحزمة لا تحول routes أو `BudgetService` أو `ExpenseService` أو Financial Reports/Exports. لا تضيف storage/download artifact أو RLS أو queue/cache. التحويل اللاحق يستهلك ownership المثبت فقط.
