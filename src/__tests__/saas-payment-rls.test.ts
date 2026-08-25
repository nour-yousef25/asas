import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("SaaS payment RLS hardening", () => {
  const migration = readFileSync(resolve(__dirname, "../../prisma/migrations/20260825110000_saas_payment_configuration_rls/migration.sql"), "utf8");
  it("requires the transaction payment configuration to belong to the session_user tenant", () => {
    expect(migration).toContain("paymentConfigurationId");
    expect(migration).toContain("payment_configurations AS configuration");
    expect(migration).toContain("configuration.\"organizationId\" = security.current_session_organization_id()");
    expect(migration).not.toMatch(/current_setting|set_config|BYPASSRLS/);
  });
  it("requires a linked platform invoice to belong to the same tenant and subscription", () => {
    const migration = readFileSync(resolve(__dirname, "../../prisma/migrations/20260825200000_platform_payment_invoice_link/migration.sql"), "utf8");
    expect(migration).toContain("platformInvoiceId");
    expect(migration).toContain('invoice."organizationId" = security.current_session_organization_id()');
    expect(migration).toContain('invoice."subscriptionId" = "subscriptionId"');
    expect(migration).not.toMatch(/current_setting|set_config|BYPASSRLS/);
  });
});
