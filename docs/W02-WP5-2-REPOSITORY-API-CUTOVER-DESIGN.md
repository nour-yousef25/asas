# W02 WP5-2 — Repository/API Cutover Design

## Scope

ينفذ WP5-2 على مراحل داخلية متسلسلة: **2A** Beneficiary و`BeneficiaryDocument` nested relation؛ **2B** Donor وDonation وDonationCampaign وProject ownership checks؛ ثم يعاد تقييم Reports/Exports وUsers/Files/Queue في مراحلها المعتمدة. لا يدخل RLS أو Cache/Queue أو Storage migration في هذا التصميم.

## Boundary

كل route محول يتبع: `requireTenantContext → requirePermission → repository`. الـrepository يستقبل `TenantContext` صراحةً ويضع `organizationId` داخلياً في كل read/write. لا يقبل input tenant identifier. عند ID من منظمة أخرى يعيد repository `null` لمسارات القراءة وNot Found، ويمنع mutation بدون resource discovery.

## 2A — Beneficiary

يضاف `BeneficiaryRepository` بعقد `list`, `getById`, `create`, `update`, `deleteOrArchive`, و`listDocuments`. يبقى relation `BeneficiaryDocument` محصوراً باستعلام parent `organizationId`؛ لا يوجد route مستقل للـDocument في المصدر الحالي، لذلك لا يدعي WP5-2 أنه حوّل `Document` root API أو object storage.

## 2B — Financial Ownership Graph

يُنشأ repository مالي يتحقق من Donor وCampaign وProject كلها ضمن organization نفسها قبل إنشاء Donation، ويكتب `organizationId` من context فقط. أي parent من منظمة مختلفة أو مجهول يؤدي إلى Not Found/Conflict fail-closed حسب العملية؛ لا تقبل route `organizationId` من body/query.

## API Contract

تتحول routes في النطاق فقط. يدعم Beneficiary list search/status/pagination scoped، وdetail get/update/delete scoped. لا تضاف migrations؛ الحقول `organizationId` موجودة ومثبتة في WP4.
