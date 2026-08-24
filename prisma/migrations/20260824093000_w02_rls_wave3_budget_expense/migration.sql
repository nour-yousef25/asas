-- W02 RLS Wave 3: Budget/Expense family. No client tenant identity or raw GUC.

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets FORCE ROW LEVEL SECURITY;
CREATE POLICY budget_session_user_tenant_isolation
    ON public.budgets FOR ALL
    USING ("organizationId" IS NOT NULL AND "organizationId" = security.current_session_organization_id())
    WITH CHECK ("organizationId" IS NOT NULL AND "organizationId" = security.current_session_organization_id());

ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items FORCE ROW LEVEL SECURITY;
CREATE POLICY budget_item_session_user_tenant_isolation
    ON public.budget_items FOR ALL
    USING ("organizationId" IS NOT NULL AND "organizationId" = security.current_session_organization_id())
    WITH CHECK (
        "organizationId" IS NOT NULL
        AND "organizationId" = security.current_session_organization_id()
        AND EXISTS (SELECT 1 FROM public.budgets AS budget WHERE budget.id = "budgetId" AND budget."organizationId" = security.current_session_organization_id())
    );

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses FORCE ROW LEVEL SECURITY;
CREATE POLICY expense_session_user_tenant_isolation
    ON public.expenses FOR ALL
    USING ("organizationId" IS NOT NULL AND "organizationId" = security.current_session_organization_id())
    WITH CHECK (
        "organizationId" IS NOT NULL
        AND "organizationId" = security.current_session_organization_id()
        AND ("budgetItemId" IS NULL OR EXISTS (SELECT 1 FROM public.budget_items AS item WHERE item.id = "budgetItemId" AND item."organizationId" = security.current_session_organization_id()))
    );
