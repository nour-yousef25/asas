-- W02 RLS Wave 2: Donor/Donation family only. Identity remains the authenticated
-- PostgreSQL session_user resolved through the protected role-OID mapping.
-- Rows without a tenant-owning parent fail closed; no default organization exists.

ALTER TABLE public.donors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donors FORCE ROW LEVEL SECURITY;
CREATE POLICY donor_session_user_tenant_isolation
    ON public.donors FOR ALL
    USING ("organizationId" IS NOT NULL AND "organizationId" = security.current_session_organization_id())
    WITH CHECK ("organizationId" IS NOT NULL AND "organizationId" = security.current_session_organization_id());

ALTER TABLE public.donation_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_campaigns FORCE ROW LEVEL SECURITY;
CREATE POLICY donation_campaign_session_user_tenant_isolation
    ON public.donation_campaigns FOR ALL
    USING ("organizationId" IS NOT NULL AND "organizationId" = security.current_session_organization_id())
    WITH CHECK ("organizationId" IS NOT NULL AND "organizationId" = security.current_session_organization_id());

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;
CREATE POLICY project_session_user_tenant_isolation
    ON public.projects FOR ALL
    USING ("organizationId" IS NOT NULL AND "organizationId" = security.current_session_organization_id())
    WITH CHECK ("organizationId" IS NOT NULL AND "organizationId" = security.current_session_organization_id());

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations FORCE ROW LEVEL SECURITY;
CREATE POLICY donation_session_user_tenant_isolation
    ON public.donations FOR ALL
    USING ("organizationId" IS NOT NULL AND "organizationId" = security.current_session_organization_id())
    WITH CHECK (
        "organizationId" IS NOT NULL
        AND "organizationId" = security.current_session_organization_id()
        AND ("donorId" IS NULL OR EXISTS (SELECT 1 FROM public.donors AS donor WHERE donor.id = "donorId" AND donor."organizationId" = security.current_session_organization_id()))
        AND ("campaignId" IS NULL OR EXISTS (SELECT 1 FROM public.donation_campaigns AS campaign WHERE campaign.id = "campaignId" AND campaign."organizationId" = security.current_session_organization_id()))
        AND ("projectId" IS NULL OR EXISTS (SELECT 1 FROM public.projects AS project WHERE project.id = "projectId" AND project."organizationId" = security.current_session_organization_id()))
    );

ALTER TABLE public.donor_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donor_communications FORCE ROW LEVEL SECURITY;
CREATE POLICY donor_communication_session_user_tenant_isolation
    ON public.donor_communications FOR ALL
    USING (EXISTS (SELECT 1 FROM public.donors AS donor WHERE donor.id = "donorId" AND donor."organizationId" = security.current_session_organization_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.donors AS donor WHERE donor.id = "donorId" AND donor."organizationId" = security.current_session_organization_id()));

ALTER TABLE public.recurring_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_donations FORCE ROW LEVEL SECURITY;
CREATE POLICY recurring_donation_session_user_tenant_isolation
    ON public.recurring_donations FOR ALL
    USING (EXISTS (SELECT 1 FROM public.donors AS donor WHERE donor.id = "donorId" AND donor."organizationId" = security.current_session_organization_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.donors AS donor WHERE donor.id = "donorId" AND donor."organizationId" = security.current_session_organization_id()));

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY invoice_donation_session_user_tenant_isolation
    ON public.invoices FOR ALL
    USING (EXISTS (SELECT 1 FROM public.donations AS donation WHERE donation.id = "donationId" AND donation."organizationId" = security.current_session_organization_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.donations AS donation WHERE donation.id = "donationId" AND donation."organizationId" = security.current_session_organization_id()));
