-- W02 mixed dashboard ownership foundation: expand-only, no backfill, no RLS.
ALTER TABLE "members" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "kpis" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "kpi_records" ADD COLUMN "organizationId" TEXT;

CREATE INDEX "members_organizationId_idx" ON "members"("organizationId");
CREATE INDEX "kpis_organizationId_idx" ON "kpis"("organizationId");
CREATE INDEX "kpi_records_organizationId_idx" ON "kpi_records"("organizationId");

ALTER TABLE "members" ADD CONSTRAINT "members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kpi_records" ADD CONSTRAINT "kpi_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
