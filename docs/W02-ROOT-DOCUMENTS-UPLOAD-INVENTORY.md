# W02 — Root Documents / Upload Inventory

حُجر `/api/upload` بحالة `410` لأن عقده القديم كان يختار path من user ويرجع URL عاماً. المسار المحلي الجديد `/api/documents` يمر عبر `TenantContext` وpolicy وBroker/tenant Prisma و`PrivateArtifactRepository`؛ لا يقبل path/organizationId من العميل، ولا يرجع URL عاماً. S01–S10 تثبت ownership وmetadata/RLS وdelivery opaque/revoke/replace/outage محلياً. يبقى provider production وbucket/KMS/DR/HA/scale خارج هذا الإغلاق المحدود.
