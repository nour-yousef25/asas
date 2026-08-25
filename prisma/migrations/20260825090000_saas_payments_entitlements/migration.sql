-- Product Decisions 54: SaaS plans/entitlements and provider-neutral tenant payment ledger.
-- No card PAN/CVV/raw provider payload is stored. All tenant tables use session_user-derived RLS.

CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "EntitlementStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED');
CREATE TYPE "PaymentPurpose" AS ENUM ('PLATFORM_BILLING', 'ORGANIZATION_DONATION');
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'VOIDED');
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED', 'REDIRECTED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'VOIDED');
CREATE TYPE "PaymentWebhookStatus" AS ENUM ('RECEIVED', 'VERIFIED', 'REJECTED', 'APPLIED');
CREATE TYPE "PaymentAdjustmentType" AS ENUM ('REFUND', 'VOID');

CREATE TABLE "platform_plans" (
  "id" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "price" DECIMAL(12,2) NOT NULL, "currency" TEXT NOT NULL DEFAULT 'SAR', "interval" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "platform_plans_code_key" ON "platform_plans"("code");

CREATE TABLE "organization_subscriptions" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "planId" TEXT NOT NULL, "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL', "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "endsAt" TIMESTAMP(3), "activatedAt" TIMESTAMP(3), "suspendedAt" TIMESTAMP(3), "expiredAt" TIMESTAMP(3), "source" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "platform_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "organization_subscriptions_organizationId_status_idx" ON "organization_subscriptions"("organizationId", "status");
CREATE INDEX "organization_subscriptions_planId_status_idx" ON "organization_subscriptions"("planId", "status");

CREATE TABLE "organization_entitlements" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "subscriptionId" TEXT NOT NULL, "key" TEXT NOT NULL, "value" JSONB, "status" "EntitlementStatus" NOT NULL DEFAULT 'ACTIVE', "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "endsAt" TIMESTAMP(3), "source" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_entitlements_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "organization_entitlements" ADD CONSTRAINT "organization_entitlements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_entitlements" ADD CONSTRAINT "organization_entitlements_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "organization_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "organization_entitlements_organizationId_key_key" ON "organization_entitlements"("organizationId", "key");
CREATE INDEX "organization_entitlements_subscriptionId_status_idx" ON "organization_entitlements"("subscriptionId", "status");

CREATE TABLE "payment_configurations" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "providerKey" TEXT NOT NULL, "credentialRef" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT false, "methods" TEXT[] NOT NULL, "callbackBaseUrl" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_configurations_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "payment_configurations" ADD CONSTRAINT "payment_configurations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "payment_configurations_organizationId_providerKey_key" ON "payment_configurations"("organizationId", "providerKey");

CREATE TABLE "payment_transactions" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "purpose" "PaymentPurpose" NOT NULL, "paymentConfigurationId" TEXT, "subscriptionId" TEXT, "donationId" TEXT, "idempotencyKey" TEXT NOT NULL, "amount" DECIMAL(12,2) NOT NULL, "currency" TEXT NOT NULL DEFAULT 'SAR', "method" TEXT NOT NULL, "providerPaymentId" TEXT, "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'CREATED', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "capturedAt" TIMESTAMP(3),
  CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_paymentConfigurationId_fkey" FOREIGN KEY ("paymentConfigurationId") REFERENCES "payment_configurations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "organization_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "donations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "payment_transactions_donationId_key" ON "payment_transactions"("donationId");
CREATE UNIQUE INDEX "payment_transactions_organizationId_idempotencyKey_key" ON "payment_transactions"("organizationId", "idempotencyKey");
CREATE INDEX "payment_transactions_organizationId_purpose_status_idx" ON "payment_transactions"("organizationId", "purpose", "status");
CREATE INDEX "payment_transactions_providerPaymentId_idx" ON "payment_transactions"("providerPaymentId");

CREATE TABLE "payment_attempts" ("id" TEXT NOT NULL, "transactionId" TEXT NOT NULL, "attemptNo" INTEGER NOT NULL, "providerRef" TEXT, "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id"));
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "payment_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "payment_attempts_transactionId_attemptNo_key" ON "payment_attempts"("transactionId", "attemptNo");

CREATE TABLE "payment_webhook_events" ("id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "transactionId" TEXT, "providerKey" TEXT NOT NULL, "providerEventId" TEXT NOT NULL, "payloadDigest" TEXT NOT NULL, "status" "PaymentWebhookStatus" NOT NULL DEFAULT 'RECEIVED', "occurredAt" TIMESTAMP(3) NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "appliedAt" TIMESTAMP(3), CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id"));
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "payment_webhook_events_organizationId_providerKey_providerEventId_key" ON "payment_webhook_events"("organizationId", "providerKey", "providerEventId");
CREATE INDEX "payment_webhook_events_transactionId_status_idx" ON "payment_webhook_events"("transactionId", "status");

CREATE TABLE "payment_reconciliations" ("id" TEXT NOT NULL, "transactionId" TEXT NOT NULL, "outcome" TEXT NOT NULL, "reasonCode" TEXT, "providerRef" TEXT, "reconciledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "payment_reconciliations_pkey" PRIMARY KEY ("id"));
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "payment_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "payment_reconciliations_transactionId_reconciledAt_idx" ON "payment_reconciliations"("transactionId", "reconciledAt");

CREATE TABLE "payment_adjustments" ("id" TEXT NOT NULL, "transactionId" TEXT NOT NULL, "type" "PaymentAdjustmentType" NOT NULL, "amount" DECIMAL(12,2) NOT NULL, "reason" TEXT NOT NULL, "providerRef" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "payment_adjustments_pkey" PRIMARY KEY ("id"));
ALTER TABLE "payment_adjustments" ADD CONSTRAINT "payment_adjustments_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "payment_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "platform_invoices" ("id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "subscriptionId" TEXT NOT NULL, "invoiceNo" TEXT NOT NULL, "amount" DECIMAL(12,2) NOT NULL, "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0, "totalAmount" DECIMAL(12,2) NOT NULL, "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED', "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "platform_invoices_pkey" PRIMARY KEY ("id"));
ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "organization_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "platform_invoices_invoiceNo_key" ON "platform_invoices"("invoiceNo");
CREATE INDEX "platform_invoices_organizationId_status_idx" ON "platform_invoices"("organizationId", "status");

ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.organization_subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_subscription_session_user_tenant_isolation ON public.organization_subscriptions FOR ALL USING ("organizationId" = security.current_session_organization_id()) WITH CHECK ("organizationId" = security.current_session_organization_id());
ALTER TABLE public.organization_entitlements ENABLE ROW LEVEL SECURITY; ALTER TABLE public.organization_entitlements FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_entitlement_session_user_tenant_isolation ON public.organization_entitlements FOR ALL USING ("organizationId" = security.current_session_organization_id()) WITH CHECK ("organizationId" = security.current_session_organization_id() AND EXISTS (SELECT 1 FROM public.organization_subscriptions AS subscription WHERE subscription.id = "subscriptionId" AND subscription."organizationId" = security.current_session_organization_id()));
ALTER TABLE public.payment_configurations ENABLE ROW LEVEL SECURITY; ALTER TABLE public.payment_configurations FORCE ROW LEVEL SECURITY;
CREATE POLICY payment_configuration_session_user_tenant_isolation ON public.payment_configurations FOR ALL USING ("organizationId" = security.current_session_organization_id()) WITH CHECK ("organizationId" = security.current_session_organization_id());
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.payment_transactions FORCE ROW LEVEL SECURITY;
CREATE POLICY payment_transaction_session_user_tenant_isolation ON public.payment_transactions FOR ALL USING ("organizationId" = security.current_session_organization_id()) WITH CHECK ("organizationId" = security.current_session_organization_id() AND ("donationId" IS NULL OR EXISTS (SELECT 1 FROM public.donations AS donation WHERE donation.id = "donationId" AND donation."organizationId" = security.current_session_organization_id())) AND ("subscriptionId" IS NULL OR EXISTS (SELECT 1 FROM public.organization_subscriptions AS subscription WHERE subscription.id = "subscriptionId" AND subscription."organizationId" = security.current_session_organization_id())));
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY; ALTER TABLE public.payment_attempts FORCE ROW LEVEL SECURITY;
CREATE POLICY payment_attempt_session_user_tenant_isolation ON public.payment_attempts FOR ALL USING (EXISTS (SELECT 1 FROM public.payment_transactions AS transaction WHERE transaction.id = "transactionId" AND transaction."organizationId" = security.current_session_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM public.payment_transactions AS transaction WHERE transaction.id = "transactionId" AND transaction."organizationId" = security.current_session_organization_id()));
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY; ALTER TABLE public.payment_webhook_events FORCE ROW LEVEL SECURITY;
CREATE POLICY payment_webhook_session_user_tenant_isolation ON public.payment_webhook_events FOR ALL USING ("organizationId" = security.current_session_organization_id()) WITH CHECK ("organizationId" = security.current_session_organization_id() AND ("transactionId" IS NULL OR EXISTS (SELECT 1 FROM public.payment_transactions AS transaction WHERE transaction.id = "transactionId" AND transaction."organizationId" = security.current_session_organization_id())));
ALTER TABLE public.payment_reconciliations ENABLE ROW LEVEL SECURITY; ALTER TABLE public.payment_reconciliations FORCE ROW LEVEL SECURITY;
CREATE POLICY payment_reconciliation_session_user_tenant_isolation ON public.payment_reconciliations FOR ALL USING (EXISTS (SELECT 1 FROM public.payment_transactions AS transaction WHERE transaction.id = "transactionId" AND transaction."organizationId" = security.current_session_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM public.payment_transactions AS transaction WHERE transaction.id = "transactionId" AND transaction."organizationId" = security.current_session_organization_id()));
ALTER TABLE public.payment_adjustments ENABLE ROW LEVEL SECURITY; ALTER TABLE public.payment_adjustments FORCE ROW LEVEL SECURITY;
CREATE POLICY payment_adjustment_session_user_tenant_isolation ON public.payment_adjustments FOR ALL USING (EXISTS (SELECT 1 FROM public.payment_transactions AS transaction WHERE transaction.id = "transactionId" AND transaction."organizationId" = security.current_session_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM public.payment_transactions AS transaction WHERE transaction.id = "transactionId" AND transaction."organizationId" = security.current_session_organization_id()));
ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY; ALTER TABLE public.platform_invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_invoice_session_user_tenant_isolation ON public.platform_invoices FOR ALL USING ("organizationId" = security.current_session_organization_id()) WITH CHECK ("organizationId" = security.current_session_organization_id() AND EXISTS (SELECT 1 FROM public.organization_subscriptions AS subscription WHERE subscription.id = "subscriptionId" AND subscription."organizationId" = security.current_session_organization_id()));
