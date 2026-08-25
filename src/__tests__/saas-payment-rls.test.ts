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
});
