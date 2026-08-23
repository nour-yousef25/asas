# W02 — Dashboard Nullable-Root Ownership Contract

يحدد هذا العقد manifest الوحيد المقبول لـMember وKPI roots. لا يُحفظ manifest الإنتاجي أو أي بيانات إنتاج في المستودع أو evidence.

```ts
type DashboardOwnershipManifestEntry = Readonly<{
  table: "Member" | "KPI";
  recordId: string;
  organizationId: string;
  source: string;
  reason?: string;
}>;
```

| حالة row | النتيجة |
|---|---|
| mapping واحد ومنظمة صحيحة ولا conflict | eligible للـapply في transaction tenant-safe |
| بلا mapping | `UNMAPPED_*`؛ لا write |
| أكثر من mapping | `AMBIGUOUS_*`؛ لا write |
| منظمة مفقودة أو owner مخالف | `INVALID_ORGANIZATION`/`CONFLICT_*`؛ لا write |
| KPIRecord owner مخالف لـKPI | `CONFLICT_KPI_RECORD`؛ لا write |
| null بعد apply | `UNEXPECTED_NULL_AFTER_APPLY`؛ rollback/fail-closed |

يستعمل audit ledger في ADR-W02-010 metadata منقحة فقط، ويشمل digest manifest وcorrelation وoperation/attempt/outcome، لكنه لا يحمل payload rows أو credentials أو tenant data. تطبيق الصفوف نفسه tenant-bound per organization وفق ADR-W02-012 وassignment protected؛ ledger control-plane لا يقرأ أو يغير tenant rows.
