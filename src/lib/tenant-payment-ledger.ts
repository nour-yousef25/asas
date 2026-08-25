import { PaymentPurpose, PaymentTransactionStatus, PaymentWebhookStatus, type PrismaClient } from "@prisma/client";
import type { TenantContext } from "@/lib/tenant-context";
import { requireTenantBoundPrismaExecutor, type TenantBoundPrismaExecutor } from "@/lib/tenant-bound-prisma-authority";

export class TenantPaymentLedgerError extends Error {
  constructor(public readonly code: "CONFIG_DENIED" | "TRANSACTION_DENIED" | "EVENT_DENIED" | "ADJUSTMENT_DENIED") { super(`TENANT_PAYMENT_${code}`); }
}

type DonationIntentInput = Readonly<{ amount: number; method: string; idempotencyKey: string; invoiceNo: string; taxNumber: string; donorId?: string; campaignId?: string; projectId?: string; isAnonymous?: boolean; isGuest?: boolean; guestName?: string; guestPhone?: string; guestEmail?: string }>;
type PlatformBillingIntentInput = Readonly<{ subscriptionId: string; amount: number; method: string; idempotencyKey: string }>;
type VerifiedEventInput = Readonly<{ transactionId: string; providerKey: string; providerEventId: string; payloadDigest: string; providerPaymentId: string; status: "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED"; occurredAt: Date }>;

export class TenantPaymentLedgerRepository {
  constructor(private readonly executor?: TenantBoundPrismaExecutor) {}
  private execute<T>(context: TenantContext, operation: (db: PrismaClient) => Promise<T>) { return (this.executor ?? requireTenantBoundPrismaExecutor()).execute(context, operation); }
  private async configuration(context: TenantContext, method: string) {
    const configuration = await this.execute(context, (db) => db.paymentConfiguration.findFirst({ where: { organizationId: context.organizationId, enabled: true, methods: { has: method } }, select: { id: true, providerKey: true } }));
    if (!configuration) throw new TenantPaymentLedgerError("CONFIG_DENIED");
    return configuration;
  }

  async createDonationIntent(context: TenantContext, input: DonationIntentInput) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new TenantPaymentLedgerError("TRANSACTION_DENIED");
    const configuration = await this.configuration(context, input.method);
    return this.execute(context, async (db) => db.$transaction(async (tx) => {
      const existing = await tx.paymentTransaction.findFirst({ where: { organizationId: context.organizationId, idempotencyKey: input.idempotencyKey }, include: { donation: true, attempts: true } });
      if (existing) return { transaction: existing, idempotent: true };
      for (const [model, id] of [["donor", input.donorId], ["donationCampaign", input.campaignId], ["project", input.projectId]] as const) {
        if (!id) continue;
        const found = await (model === "donor" ? tx.donor.findFirst({ where: { id, organizationId: context.organizationId } }) : model === "donationCampaign" ? tx.donationCampaign.findFirst({ where: { id, organizationId: context.organizationId } }) : tx.project.findFirst({ where: { id, organizationId: context.organizationId } }));
        if (!found) throw new TenantPaymentLedgerError("TRANSACTION_DENIED");
      }
      const donation = await tx.donation.create({ data: { organizationId: context.organizationId, amount: input.amount, paymentMethod: input.method, status: "PENDING", isAnonymous: input.isAnonymous ?? false, isGuest: input.isGuest ?? false, guestName: input.guestName, guestPhone: input.guestPhone, guestEmail: input.guestEmail, donorId: input.donorId, campaignId: input.campaignId, projectId: input.projectId } });
      await tx.invoice.create({ data: { invoiceNo: input.invoiceNo, donationId: donation.id, amount: input.amount, taxAmount: 0, totalAmount: input.amount, taxNumber: input.taxNumber, buyerName: input.guestName, buyerPhone: input.guestPhone, buyerEmail: input.guestEmail, status: "ISSUED" } });
      const transaction = await tx.paymentTransaction.create({ data: { organizationId: context.organizationId, purpose: PaymentPurpose.ORGANIZATION_DONATION, paymentConfigurationId: configuration.id, donationId: donation.id, idempotencyKey: input.idempotencyKey, amount: input.amount, method: input.method, status: PaymentTransactionStatus.CREATED } });
      await tx.paymentAttempt.create({ data: { transactionId: transaction.id, attemptNo: 1, status: "CREATED" } });
      await tx.auditLog.create({ data: { organizationId: context.organizationId, userId: context.userId, action: "PAYMENT_DONATION_INTENT_CREATED", entity: "PaymentTransaction", entityId: transaction.id, details: { purpose: "ORGANIZATION_DONATION", idempotencyKey: input.idempotencyKey, correlationId: context.correlationId } } });
      return { transaction, donation, idempotent: false };
    }));
  }

  async createPlatformBillingIntent(context: TenantContext, input: PlatformBillingIntentInput) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new TenantPaymentLedgerError("TRANSACTION_DENIED");
    const configuration = await this.configuration(context, input.method);
    return this.execute(context, async (db) => db.$transaction(async (tx) => {
      const subscription = await tx.organizationSubscription.findFirst({ where: { id: input.subscriptionId, organizationId: context.organizationId }, select: { id: true } });
      if (!subscription) throw new TenantPaymentLedgerError("TRANSACTION_DENIED");
      const existing = await tx.paymentTransaction.findFirst({ where: { organizationId: context.organizationId, idempotencyKey: input.idempotencyKey } });
      if (existing) return { transaction: existing, idempotent: true };
      const transaction = await tx.paymentTransaction.create({ data: { organizationId: context.organizationId, purpose: PaymentPurpose.PLATFORM_BILLING, paymentConfigurationId: configuration.id, subscriptionId: subscription.id, idempotencyKey: input.idempotencyKey, amount: input.amount, method: input.method, status: PaymentTransactionStatus.CREATED } });
      await tx.paymentAttempt.create({ data: { transactionId: transaction.id, attemptNo: 1, status: "CREATED" } });
      await tx.auditLog.create({ data: { organizationId: context.organizationId, userId: context.userId, action: "PAYMENT_PLATFORM_BILLING_INTENT_CREATED", entity: "PaymentTransaction", entityId: transaction.id, details: { purpose: "PLATFORM_BILLING", idempotencyKey: input.idempotencyKey, correlationId: context.correlationId } } });
      return { transaction, idempotent: false };
    }));
  }

  async recordVerifiedEvent(context: TenantContext, event: VerifiedEventInput) {
    return this.execute(context, async (db) => db.$transaction(async (tx) => {
      const transaction = await tx.paymentTransaction.findFirst({ where: { id: event.transactionId, organizationId: context.organizationId }, include: { donation: { include: { invoice: true, project: true, campaign: true, donor: true } } } });
      if (!transaction) throw new TenantPaymentLedgerError("TRANSACTION_DENIED");
      const prior = await tx.paymentWebhookEvent.findFirst({ where: { organizationId: context.organizationId, providerKey: event.providerKey, providerEventId: event.providerEventId } });
      if (prior) return { applied: false, idempotent: true };
      await tx.paymentWebhookEvent.create({ data: { organizationId: context.organizationId, transactionId: transaction.id, providerKey: event.providerKey, providerEventId: event.providerEventId, payloadDigest: event.payloadDigest, status: PaymentWebhookStatus.VERIFIED, occurredAt: event.occurredAt } });
      const status = event.status === "CAPTURED" ? PaymentTransactionStatus.CAPTURED : event.status === "AUTHORIZED" ? PaymentTransactionStatus.AUTHORIZED : event.status === "REFUNDED" ? PaymentTransactionStatus.REFUNDED : PaymentTransactionStatus.FAILED;
      if (transaction.status === PaymentTransactionStatus.CAPTURED && status === PaymentTransactionStatus.CAPTURED) return { applied: false, idempotent: true };
      await tx.paymentTransaction.update({ where: { id: transaction.id }, data: { status, providerPaymentId: event.providerPaymentId, capturedAt: status === PaymentTransactionStatus.CAPTURED ? event.occurredAt : undefined } });
      if (status === PaymentTransactionStatus.CAPTURED && transaction.donation) {
        await tx.donation.update({ where: { id: transaction.donation.id }, data: { status: "COMPLETED", paymentRef: event.providerPaymentId } });
        if (transaction.donation.invoice) await tx.invoice.update({ where: { id: transaction.donation.invoice.id }, data: { status: "PAID" } });
        if (transaction.donation.project) await tx.project.update({ where: { id: transaction.donation.project.id }, data: { collectedAmount: { increment: Number(transaction.amount) } } });
        if (transaction.donation.campaign) await tx.donationCampaign.update({ where: { id: transaction.donation.campaign.id }, data: { collectedAmount: { increment: Number(transaction.amount) } } });
        if (transaction.donation.donor) await tx.donor.update({ where: { id: transaction.donation.donor.id }, data: { totalDonations: { increment: Number(transaction.amount) }, lastDonationAt: event.occurredAt } });
      }
      await tx.paymentWebhookEvent.updateMany({ where: { organizationId: context.organizationId, providerKey: event.providerKey, providerEventId: event.providerEventId }, data: { status: PaymentWebhookStatus.APPLIED, appliedAt: new Date() } });
      await tx.paymentReconciliation.create({ data: { transactionId: transaction.id, outcome: status, providerRef: event.providerPaymentId } });
      await tx.auditLog.create({ data: { organizationId: context.organizationId, userId: context.userId, action: "PAYMENT_EVENT_APPLIED", entity: "PaymentTransaction", entityId: transaction.id, details: { providerKey: event.providerKey, providerEventId: event.providerEventId, status, correlationId: context.correlationId } } });
      return { applied: true, idempotent: false };
    }));
  }

  async requestAdjustment(context: TenantContext, input: Readonly<{ transactionId: string; type: "REFUND" | "VOID"; amount: number; reason: string }>) {
    if (!Number.isFinite(input.amount) || input.amount <= 0 || !input.reason.trim()) throw new TenantPaymentLedgerError("ADJUSTMENT_DENIED");
    return this.execute(context, async (db) => db.$transaction(async (tx) => {
      const transaction = await tx.paymentTransaction.findFirst({ where: { id: input.transactionId, organizationId: context.organizationId }, select: { id: true, amount: true, status: true } });
      const voidable: PaymentTransactionStatus[] = [PaymentTransactionStatus.CREATED, PaymentTransactionStatus.PENDING, PaymentTransactionStatus.AUTHORIZED];
      if (!transaction || input.amount > Number(transaction.amount) || (input.type === "REFUND" && transaction.status !== PaymentTransactionStatus.CAPTURED) || (input.type === "VOID" && !voidable.includes(transaction.status))) throw new TenantPaymentLedgerError("ADJUSTMENT_DENIED");
      return tx.paymentAdjustment.create({ data: { transactionId: transaction.id, type: input.type, amount: input.amount, reason: input.reason.trim() } });
    }));
  }
}

export const tenantPaymentLedgerRepository = new TenantPaymentLedgerRepository();
