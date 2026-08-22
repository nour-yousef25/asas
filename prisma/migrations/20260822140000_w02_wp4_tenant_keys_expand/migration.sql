-- W02 WP4: nullable tenant keys only. No automatic legacy assignment and no destructive constraint hardening.
ALTER TABLE "beneficiaries" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "donors" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

CREATE INDEX IF NOT EXISTS "beneficiaries_organizationId_idx" ON "beneficiaries"("organizationId");
CREATE INDEX IF NOT EXISTS "donors_organizationId_idx" ON "donors"("organizationId");
CREATE INDEX IF NOT EXISTS "donations_organizationId_idx" ON "donations"("organizationId");
CREATE INDEX IF NOT EXISTS "donation_campaigns_organizationId_idx" ON "donation_campaigns"("organizationId");
CREATE INDEX IF NOT EXISTS "projects_organizationId_idx" ON "projects"("organizationId");
CREATE INDEX IF NOT EXISTS "news_organizationId_idx" ON "news"("organizationId");
CREATE INDEX IF NOT EXISTS "events_organizationId_idx" ON "events"("organizationId");
CREATE INDEX IF NOT EXISTS "tasks_organizationId_idx" ON "tasks"("organizationId");
CREATE INDEX IF NOT EXISTS "surveys_organizationId_idx" ON "surveys"("organizationId");
CREATE INDEX IF NOT EXISTS "documents_organizationId_idx" ON "documents"("organizationId");

ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "donors" ADD CONSTRAINT "donors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "donations" ADD CONSTRAINT "donations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "donation_campaigns" ADD CONSTRAINT "donation_campaigns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "news" ADD CONSTRAINT "news_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
