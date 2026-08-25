import { MailDispatchService, MailTransportError } from "@/lib/mail-transport";
import { DomainScheduler, MemorySchedulerRunStore, parseSchedulerCatalogue } from "@/lib/domain-scheduler";
import { MemoryPaymentLedger, PaymentGatewayService, paymentEventDigest, type PaymentProvider } from "@/lib/payment-gateway";
import { opaqueSecretReference } from "@/lib/w02-security-contracts";

describe("mail, payment, and scheduler launch boundaries", () => {
  it("never sends mail when delivery is disabled and redacts recipients in audit data", async () => {
    const transport = { deliver: jest.fn() };
    const service = new MailDispatchService(transport, false);
    const message = { organizationId: "org_123456789012", idempotencyKey: "mail.delivery:123456789", to: ["person@charity.sa"], subject: "Subject", text: "Body" };
    await expect(service.deliver(message, { sender: "no-reply@charity.sa", secretReference: opaqueSecretReference("secretref:mail-credential-1234"), environment: "PRODUCTION" })).rejects.toMatchObject({ code: "DELIVERY_DISABLED" } satisfies Partial<MailTransportError>);
    expect(service.audit(message, "QUEUED").recipientFingerprints[0]).not.toContain("person@charity.sa");
    expect(transport.deliver).not.toHaveBeenCalled();
  });

  it("records only verified tenant-bound payment events idempotently", async () => {
    const rawBody = '{"event":"captured"}';
    const provider: PaymentProvider = { createIntent: async () => ({ providerPaymentId: "p1", checkoutUrl: "https://payments.example.test/p1" }), verifyWebhook: async () => ({ organizationId: "org_123456789012", providerKey: "provider", providerEventId: "evt1", providerPaymentId: "p1", status: "CAPTURED", amount: 10, currency: "SAR", occurredAt: new Date(), payloadDigest: paymentEventDigest(rawBody) }), reconcile: async () => { throw new Error("unused"); } };
    const service = new PaymentGatewayService(provider, new MemoryPaymentLedger());
    await expect(service.receiveWebhook(rawBody, new Headers())).resolves.toMatchObject({ ledger: { recorded: true } });
    await expect(service.receiveWebhook(rawBody, new Headers())).resolves.toMatchObject({ ledger: { recorded: false } });
  });

  it("supports only approved catalogue jobs with dry-run, pause and idempotency guards", async () => {
    const catalogue = parseSchedulerCatalogue({ schemaVersion: 1, jobs: [{ key: "publish.tenant", owner: "Communications Operations", version: "1.0.0", tenantMode: "TENANT", intervalSeconds: 300, timeoutSeconds: 30, retryLimit: 2, approved: true, paused: false }] });
    const store = new MemorySchedulerRunStore();
    const scheduler = new DomainScheduler(catalogue, store, { execute: jest.fn() }, () => new Date("2026-08-25T12:00:00.000Z"));
    const input = { jobKey: "publish.tenant", organizationId: "org_123456789012", scheduledFor: new Date("2026-08-25T12:00:00.000Z") };
    await expect(scheduler.run({ ...input, dryRun: true })).resolves.toMatchObject({ outcome: "DRY_RUN" });
    await expect(scheduler.run({ ...input, dryRun: false })).resolves.toMatchObject({ outcome: "SUCCEEDED" });
    await expect(scheduler.run({ ...input, dryRun: false })).resolves.toMatchObject({ outcome: "DUPLICATE" });
  });
});
