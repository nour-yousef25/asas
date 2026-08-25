import { createHash } from "node:crypto";
import { z } from "zod";

export class PaymentGatewayError extends Error {
  constructor(public readonly code: "UNCONFIGURED" | "INPUT_DENIED" | "SIGNATURE_DENIED" | "TENANT_DENIED" | "RECONCILIATION_DENIED" | "PROVIDER_REJECTED") { super(`PAYMENT_${code}`); }
}

export const paymentIntentSchema = z.object({ organizationId: z.string().regex(/^[A-Za-z0-9_-]{12,160}$/), amount: z.number().positive().finite(), currency: z.literal("SAR"), method: z.enum(["mada", "visa", "mastercard", "applepay", "stcpay", "bank_transfer"]), idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{16,180}$/), callbackUrl: z.string().url().refine((value) => new URL(value).protocol === "https:") });
export type PaymentIntent = z.infer<typeof paymentIntentSchema>;
export type VerifiedPaymentEvent = Readonly<{ organizationId: string; providerKey: string; providerEventId: string; providerPaymentId: string; status: "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED"; amount: number; currency: "SAR"; occurredAt: Date; payloadDigest: string }>;
export type PaymentProvider = Readonly<{ createIntent(input: PaymentIntent): Promise<Readonly<{ providerPaymentId: string; checkoutUrl: string }>>; verifyWebhook(input: Readonly<{ rawBody: string; headers: Headers }>): Promise<VerifiedPaymentEvent>; reconcile(input: Readonly<{ organizationId: string; providerPaymentId: string }>): Promise<VerifiedPaymentEvent> }>;
export type PaymentLedger = Readonly<{ record(event: VerifiedPaymentEvent): Promise<Readonly<{ recorded: boolean; reconciliationRequired: boolean }>> }>;

let installedProvider: PaymentProvider | undefined;
export function installPaymentProvider(provider: PaymentProvider) { if (installedProvider) throw new PaymentGatewayError("UNCONFIGURED"); installedProvider = provider; }
export function requirePaymentProvider() { if (!installedProvider) throw new PaymentGatewayError("UNCONFIGURED"); return installedProvider; }
export function paymentEventDigest(rawBody: string) { return createHash("sha256").update(rawBody).digest("base64url"); }

export class PaymentGatewayService {
  constructor(private readonly provider: PaymentProvider = requirePaymentProvider(), private readonly ledger?: PaymentLedger) {}
  async create(input: unknown) { return this.provider.createIntent(paymentIntentSchema.parse(input)); }
  async receiveWebhook(rawBody: string, headers: Headers) {
    const event = await this.provider.verifyWebhook({ rawBody, headers });
    if (!event.organizationId || event.payloadDigest !== paymentEventDigest(rawBody)) throw new PaymentGatewayError("TENANT_DENIED");
    if (!this.ledger) throw new PaymentGatewayError("RECONCILIATION_DENIED");
    return { event, ledger: await this.ledger.record(event) };
  }
  async reconcile(organizationId: string, providerPaymentId: string) {
    const event = await this.provider.reconcile({ organizationId, providerPaymentId });
    if (event.organizationId !== organizationId || !this.ledger) throw new PaymentGatewayError("RECONCILIATION_DENIED");
    return { event, ledger: await this.ledger.record(event) };
  }
}

export class MemoryPaymentLedger implements PaymentLedger {
  private readonly events = new Map<string, VerifiedPaymentEvent>();
  async record(event: VerifiedPaymentEvent) {
    const key = `${event.organizationId}:${event.providerKey}:${event.providerEventId}`;
    if (this.events.has(key)) return { recorded: false, reconciliationRequired: false };
    this.events.set(key, event);
    return { recorded: true, reconciliationRequired: event.status === "AUTHORIZED" };
  }
}
