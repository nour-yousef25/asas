-- Platform billing must settle through the School Screen merchant path and its own invoice.
-- This migration is additive and does not alter historical payment migrations.
ALTER TABLE public.payment_transactions
  ADD COLUMN "platformInvoiceId" TEXT;

ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_platform_invoice_id_fkey
  FOREIGN KEY ("platformInvoiceId") REFERENCES public.platform_invoices(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX payment_transactions_platform_invoice_id_key
  ON public.payment_transactions("platformInvoiceId");

DROP POLICY IF EXISTS payment_transaction_session_user_tenant_isolation ON public.payment_transactions;
CREATE POLICY payment_transaction_session_user_tenant_isolation
  ON public.payment_transactions FOR ALL
  USING ("organizationId" = security.current_session_organization_id())
  WITH CHECK (
    "organizationId" = security.current_session_organization_id()
    AND ("paymentConfigurationId" IS NULL OR EXISTS (
      SELECT 1 FROM public.payment_configurations AS configuration
      WHERE configuration.id = "paymentConfigurationId"
        AND configuration."organizationId" = security.current_session_organization_id()
    ))
    AND ("donationId" IS NULL OR EXISTS (
      SELECT 1 FROM public.donations AS donation
      WHERE donation.id = "donationId"
        AND donation."organizationId" = security.current_session_organization_id()
    ))
    AND ("subscriptionId" IS NULL OR EXISTS (
      SELECT 1 FROM public.organization_subscriptions AS subscription
      WHERE subscription.id = "subscriptionId"
        AND subscription."organizationId" = security.current_session_organization_id()
    ))
    AND ("platformInvoiceId" IS NULL OR EXISTS (
      SELECT 1 FROM public.platform_invoices AS invoice
      WHERE invoice.id = "platformInvoiceId"
        AND invoice."organizationId" = security.current_session_organization_id()
        AND ("subscriptionId" IS NULL OR invoice."subscriptionId" = "subscriptionId")
    ))
  );
