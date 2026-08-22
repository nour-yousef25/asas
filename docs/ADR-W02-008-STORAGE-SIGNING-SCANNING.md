# ADR-W02-008 — Private Object Storage, Signing and Scanning

**Gate:** G-W02-8
**الحالة:** `CLOSED — DESIGN DECISION`
**المالك:** Operations Owner وSecurity Owner.

## Decision

يعتمد W02 S3-compatible object storage خاصاً كعقد مدعوم، مع provider credentials حسب edition. المفتاح القانوني هو `org/{organizationId}/{classification}/{fileId}`. يحتفظ التطبيق بmetadata في `StoredObject` ولا يعيد raw object URL. يصدر service URL موقّعاً قصير العمر بعد policy/classification/purpose check فقط.

## Security Contract

objects private؛ expiry الافتراضي للتحميل 5 دقائق وقابل للإلغاء بتعطيل object/version. upload يتحقق server-side من size/type وcontent sniffing وchecksum؛ كل ملف غير موثوق يدخل quarantine ولا يصبح available حتى scanner verdict. لا يقبل filename كجزء authority من key. تسجل upload/download/share/export/scan/revoke events منقحة.

## Responsibility and Evidence

Cloud: ASAS يدير bucket policy/signing/scanner. Dedicated: shared حسب العقد. Self-hosted: customer يدير provider/scanner وإثبات health. تتطلب WP1 cross-org download، expiry/revoke، path traversal، malicious file/quarantine وchecksum tests. لا storage migration أو provider config تغير في WP0.
