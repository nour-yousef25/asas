-- Reconciliation 54 hardening: a tenant payment transaction may only reference its own configuration.
-- This corrects the initial SaaS/payment ledger policy without editing historical migrations.

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
  );
