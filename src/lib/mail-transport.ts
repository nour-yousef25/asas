import { createHash } from "node:crypto";
import { z } from "zod";
import type { OpaqueSecretReference } from "@/lib/w02-security-contracts";

export class MailTransportError extends Error {
  constructor(public readonly code: "UNCONFIGURED" | "DELIVERY_DISABLED" | "SANDBOX_RECIPIENT_DENIED" | "MESSAGE_DENIED" | "PROVIDER_REJECTED") { super(`MAIL_${code}`); }
}

export const mailMessageSchema = z.object({
  organizationId: z.string().regex(/^[A-Za-z0-9_-]{12,160}$/),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{16,180}$/),
  to: z.array(z.string().email()).min(1).max(25),
  subject: z.string().trim().min(1).max(200),
  text: z.string().min(1).max(100_000),
  html: z.string().min(1).max(200_000).optional(),
});
export type MailMessage = z.infer<typeof mailMessageSchema>;
export type MailConfiguration = Readonly<{ sender: string; secretReference: OpaqueSecretReference; environment: "SANDBOX" | "PRODUCTION"; sandboxRecipientAllowList?: readonly string[]; timeoutMs?: number; maxAttempts?: number }>;
export type MailTransport = Readonly<{ deliver(input: Readonly<{ message: MailMessage; configuration: MailConfiguration }>): Promise<Readonly<{ providerMessageId: string }>>; probe?(): Promise<void> }>;
export type MailAuditEvent = Readonly<{ organizationId: string; idempotencyKey: string; recipientFingerprints: readonly string[]; action: "QUEUED" | "SENT" | "FAILED"; providerMessageId?: string }>;

let installedTransport: MailTransport | undefined;
export function installMailTransport(transport: MailTransport) { if (installedTransport) throw new MailTransportError("UNCONFIGURED"); installedTransport = transport; }
export function requireMailTransport() { if (!installedTransport) throw new MailTransportError("UNCONFIGURED"); return installedTransport; }
function fingerprint(value: string) { return createHash("sha256").update(`asas-mail:${value.toLowerCase()}`).digest("base64url"); }

export class MailDispatchService {
  constructor(private readonly transport: MailTransport = requireMailTransport(), private readonly enabled = process.env.ASAS_MAIL_DELIVERY_ENABLED === "true", private readonly recordAudit: (event: MailAuditEvent) => Promise<void> = async () => undefined) {}
  audit(message: MailMessage, action: MailAuditEvent["action"], providerMessageId?: string): MailAuditEvent {
    return { organizationId: message.organizationId, idempotencyKey: message.idempotencyKey, recipientFingerprints: message.to.map(fingerprint), action, providerMessageId };
  }
  async deliver(input: unknown, configuration: MailConfiguration) {
    const message = mailMessageSchema.parse(input);
    if (!z.string().email().safeParse(configuration.sender).success || !configuration.secretReference) throw new MailTransportError("UNCONFIGURED");
    if (configuration.environment === "SANDBOX" && !message.to.every((recipient) => configuration.sandboxRecipientAllowList?.includes(recipient))) throw new MailTransportError("SANDBOX_RECIPIENT_DENIED");
    await this.recordAudit(this.audit(message, "QUEUED"));
    if (!this.enabled) { await this.recordAudit(this.audit(message, "FAILED")); throw new MailTransportError("DELIVERY_DISABLED"); }
    const timeoutMs = configuration.timeoutMs ?? 10_000;
    const maxAttempts = configuration.maxAttempts ?? 3;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000 || !Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) throw new MailTransportError("MESSAGE_DENIED");
    try {
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const result = await Promise.race([
            this.transport.deliver({ message, configuration }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new MailTransportError("PROVIDER_REJECTED")), timeoutMs)),
          ]);
          if (!result.providerMessageId) throw new MailTransportError("PROVIDER_REJECTED");
          const audit = this.audit(message, "SENT", result.providerMessageId);
          await this.recordAudit(audit);
          return { result, audit, attempts: attempt };
        } catch (error) { lastError = error; }
      }
      throw lastError;
    } catch (error) { await this.recordAudit(this.audit(message, "FAILED")); if (error instanceof MailTransportError) throw error; throw new MailTransportError("PROVIDER_REJECTED"); }
  }
}
