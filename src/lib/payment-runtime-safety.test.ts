import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { paymentIntentSchema } from "@/lib/payment-gateway";

describe("payment runtime safety before a real provider is installed", () => {
  it("accepts SAR amounts with two-decimal precision only", () => {
    const base = { organizationId: "org_123456789012", amount: 10, currency: "SAR", method: "mada", idempotencyKey: "payment.safety:123456789", callbackUrl: "https://payments.example.test/callback" };
    expect(paymentIntentSchema.safeParse(base).success).toBe(true);
    expect(paymentIntentSchema.safeParse({ ...base, amount: 10.001 }).success).toBe(false);
    expect(paymentIntentSchema.safeParse({ ...base, currency: "USD" }).success).toBe(false);
  });

  it("keeps public donation checkout fail-closed instead of completing donations outside the payment ledger", () => {
    const route = readFileSync(resolve(__dirname, "../app/api/donations/route.ts"), "utf8");
    expect(route).toContain("PAYMENT_CHECKOUT_UNAVAILABLE");
    expect(route).not.toContain("financialRepository.createDonation");
    expect(route).not.toContain("processPayment");
  });

  it("keeps the payment webhook unavailable until a provider verifier and ledger wiring are installed", () => {
    const route = readFileSync(resolve(__dirname, "../app/api/payment/webhook/route.ts"), "utf8");
    expect(route).toContain("PAYMENT_WEBHOOK_LEDGER_UNCONFIGURED");
    expect(route).toContain("PAYMENT_PROVIDER_UNCONFIGURED");
    expect(route).not.toContain("receiveWebhook(");
  });
});
