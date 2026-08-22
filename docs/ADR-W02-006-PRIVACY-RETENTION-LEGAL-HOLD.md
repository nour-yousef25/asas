# ADR-W02-006 — Privacy, Retention and Legal Hold

**Gate:** G-W02-6
**الحالة:** `CLOSED — DESIGN DECISION`
**المالك:** Privacy/Data Owner وSecurity Owner.

## Decision

يعتمد W02 أربع classifications: `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, `RESTRICTED`. يتطلب read/export حساس `purposeCode` وpolicy decision. تصنف national identifiers، beneficiary documents، financial/HR records والأسرار `RESTRICTED` أو `CONFIDENTIAL` وفق catalog. يسجل audit metadata منقحة ولا يحمل raw PII أو tokens.

## Retention, DSAR and Legal Hold

تحدد policy لكل data class/record type retention owner وexpiry وhold status. legal hold يوقف purge/delete/correction التنفيذية حيث يلزم، بينما يسمح بتسجيل DSAR request وسبب الرفض/التأجيل. export يخضع لـpurpose وpermission وclassification والتدقيق؛ delete/correction لا تتجاوز financial/audit retention أو hold. تفاصيل المدد القانونية country-specific لا تختلق في WP0 وتحتاج اعتماد Data Owner قبل runtime.

## Evidence and Tests

WP1 يثبت masking، purpose required، export denial، DSAR lifecycle، retention candidate، legal hold وredaction. الدليل WP0 هو القرار وthreat assumptions؛ لا privacy migration أو processing job نفذ الآن.
