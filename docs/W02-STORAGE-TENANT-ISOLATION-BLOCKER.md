# W02 — Storage Tenant Isolation Blocker

الحالة: **LOCAL SECURITY/DESIGN BLOCKER.** `src/lib/storage.ts` يستقبل path من caller، ويستعمل credential bucket عاماً، ويصدر URLs عامة، ولا يملك `TenantContext` أو namespace مستأجرياً أو authorization على document ownership. كما يحتوي development fallbacks لمفاتيح MinIO؛ لا يجوز استخدامها كإعداد إنتاجي أو evidence.

المسار المطلوب قبل إغلاق Storage: حذف fallback الأمني من data-plane، trusted tenant context server-side، object prefix لا يختاره العميل، DB ownership check، signed URL محدود object/action/expiry، delete/download denial A/B، rotation/replay/cleanup evidence. لا ينفذ provider حقيقي أو credentials داخل هذا scope.
