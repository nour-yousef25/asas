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
export type MailConfiguration = Readonly<{ sender: string; secretReference: OpaqueSecretReference; environment: "SANDBOX" | "PRODUCTION"; sandboxRecipientAllowList?: readonly string[] }>;
export type MailTransport = Readonly<{ deliver(input: Readonly<{ message: MailMessage; configuration: MailConfiguration }>): Promise<Readonly<{ providerMessageId: string }>>; probe?(): Promise<void> }>;
export type MailAuditEvent = Readonly<{ organizationId: string; idempotencyKey: string; recipientFingerprints: readonly string[]; action: "QUEUED" | "SENT" | "FAILED"; providerMessageId?: string }>;

let installedTransport: MailTransport | undefined;
export function installMailTransport(transport: MailTransport) { if (installedTransport) throw new MailTransportError("UNCONFIGURED"); installedTransport = transport; }
export function requireMailTransport() { if (!installedTransport) throw new MailTransportError("UNCONFIGURED"); return installedTransport; }
function fingerprint(value: string) { return createHash("sha256").update(`asas-mail:${value.toLowerCase()}`).digest("base64url"); }

export class MailDispatchService {
  constructor(private readonly transport: MailTransport = requireMailTransport(), private readonly enabled = process.env.ASAS_MAIL_DELIVERY_ENABLED === "true") {}
  audit(message: MailMessage, action: MailAuditEvent["action"], providerMessageId?: string): MailAuditEvent {
    return { organizationId: message.organizationId, idempotencyKey: message.idempotencyKey, recipientFingerprints: message.to.map(fingerprint), action, providerMessageId };
  }
  async deliver(input: unknown, configuration: MailConfiguration) {
    const message = mailMessageSchema.parse(input);
    if (!configuration.sender || !configuration.secretReference) throw new MailTransportError("UNCONFIGURED");
    if (configuration.environment === "SANDBOX" && !message.to.every((recipient) => configuration.sandboxRecipientAllowList?.includes(recipient))) throw new MailTransportError("SANDBOX_RECIPIENT_DENIED");
    if (!this.enabled) throw new MailTransportError("DELIVERY_DISABLED");
    try {
      const result = await this.transport.deliver({ message, configuration });
      if (!result.providerMessageId) throw new MailTransportError("PROVIDER_REJECTED");
      return { result, audit: this.audit(message, "SENT", result.providerMessageId) };
    } catch (error) { if (error instanceof MailTransportError) throw error; throw new MailTransportError("PROVIDER_REJECTED"); }
  }
}
