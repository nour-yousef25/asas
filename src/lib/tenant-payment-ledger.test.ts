import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Tenant payment ledger structural guards", () => {
  const source = readFileSync(resolve(__dirname, "tenant-payment-ledger.ts"), "utf8");
  it("uses tenant-bound authority and has no global Prisma/card-data surfaces", () => {
    expect(source).toContain("requireTenantBoundPrismaExecutor");
    expect(source).not.toMatch(/from "@\/lib\/db"/);
    expect(source).not.toMatch(/cardNumber|cardCvv|cardCVV|pan|rawPayload/);
  });
  it("requires idempotency and applies donation completion only after CAPTURED", () => {
    expect(source).toContain("idempotencyKey");
    expect(source).toContain("PaymentTransactionStatus.CAPTURED");
    expect(source).toContain('status: "COMPLETED"');
    expect(source).toContain("paymentWebhookEvent");
  });
  it("separates the platform merchant from organization payment configuration and checks captured values", () => {
    expect(source).toContain("platformMerchantAttemptReference");
    expect(source).toContain("merchantScope: \"PLATFORM\"");
    expect(source).toContain("paymentConfigurationId: configuration.id");
    expect(source).toContain("Number(transaction.amount) !== event.amount");
    expect(source).toContain("transaction.currency !== event.currency");
    expect(source).toContain("transaction.configuration?.providerKey !== event.providerKey");
  });
});
