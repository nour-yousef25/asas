-- W02 WP5-3 Budget Ownership Foundation: expand-only, no backfill/hardening.
ALTER TABLE "budgets" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "budget_items" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "expenses" ADD COLUMN "organizationId" TEXT;

CREATE INDEX "budgets_organizationId_idx" ON "budgets"("organizationId");
CREATE INDEX "budget_items_organizationId_idx" ON "budget_items"("organizationId");
CREATE INDEX "expenses_organizationId_idx" ON "expenses"("organizationId");

ALTER TABLE "budgets" ADD CONSTRAINT "budgets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
