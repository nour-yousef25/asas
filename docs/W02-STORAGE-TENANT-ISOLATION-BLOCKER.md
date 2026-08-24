# W02 — Storage Tenant Isolation Blocker

الحالة: **RESOLVED — COMPLETE LIMITED AUDIT RUNTIME.** حُجر `src/lib/storage.ts` و`/api/upload` fail-closed؛ لا يقبلان path من caller ولا يحتفظان bucket credential أو URL عام أو MinIO fallback. المسار الجديد `PrivateArtifactRepository` يأخذ `TenantContext` الخادمي، ويبني key خادمي immutable، ويثبت ownership في metadata وPostgreSQL RLS قبل provider injected opaque delivery.

أثبت S01–S10 A/B وforged artifact/path وexpiry وrevoke/stale policy وreplace/delete وoutage وparallel وcleanup/hygiene عبر PostgreSQL disposable وmemory-only provider. يبقى bucket/KMS/credential resolution وmalware scanning وretention/backup وprovider availability وDR/HA/scale **EXTERNAL DEPLOYMENT PREREQUISITE**؛ لا تعد هذه الأدلة تشغيل provider حقيقياً ولا تعيد السطح الخام.
