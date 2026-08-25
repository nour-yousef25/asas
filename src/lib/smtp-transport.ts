/** SMTP readiness: root-only configuration, SANDBOX-only delivery, and no transport when configuration is absent. */
import { stat, readFile } from "node:fs/promises";
import * as nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import { z } from "zod";
import { MailTransportError, installMailTransport, mailTransportInstalled, type MailTransport } from "@/lib/mail-transport";

export const smtpTransportConfigurationSchema = z.object({
  host: z.string().trim().min(1).max(253),
  port: z.number().int().min(1).max(65_535),
  security: z.enum(["STARTTLS", "TLS"]),
  username: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(4_096),
  sender: z.string().email(),
  replyTo: z.string().email().optional(),
  environment: z.literal("SANDBOX"),
  sandboxRecipientAllowList: z.array(z.string().email()).min(1).max(25),
  timeoutMs: z.number().int().min(1_000).max(60_000).default(10_000),
  maxAttempts: z.number().int().min(1).max(3).default(3),
}).strict();

export type SmtpTransportConfiguration = z.infer<typeof smtpTransportConfigurationSchema>;

async function readRootOnlyJson(path: string) {
  const details = await stat(path).catch(() => undefined);
  if (!details?.isFile() || details.uid !== 0 || details.gid !== 0 || (details.mode & 0o077) !== 0) throw new MailTransportError("UNCONFIGURED");
  return JSON.parse(await readFile(path, "utf8"));
}

export async function loadRootOnlySmtpTransportConfiguration(path: string): Promise<SmtpTransportConfiguration> {
  try {
    return smtpTransportConfigurationSchema.parse(await readRootOnlyJson(path));
  } catch {
    throw new MailTransportError("UNCONFIGURED");
  }
}

export function createSmtpTransport(configuration: SmtpTransportConfiguration): MailTransport {
  const transportOptions: SMTPTransport.Options = {
    host: configuration.host,
    port: configuration.port,
    secure: configuration.security === "TLS",
    requireTLS: configuration.security === "STARTTLS",
    auth: { user: configuration.username, pass: configuration.password },
    connectionTimeout: configuration.timeoutMs,
    greetingTimeout: configuration.timeoutMs,
    socketTimeout: configuration.timeoutMs,
  };
  const transporter = nodemailer.createTransport(transportOptions);
  return Object.freeze({
    async probe() { await transporter.verify(); },
    async deliver({ message, configuration: dispatchConfiguration }) {
      if (dispatchConfiguration.environment !== "SANDBOX" || dispatchConfiguration.sender !== configuration.sender) throw new MailTransportError("MESSAGE_DENIED");
      if (!message.to.every((recipient) => configuration.sandboxRecipientAllowList.includes(recipient))) throw new MailTransportError("SANDBOX_RECIPIENT_DENIED");
      const result = await transporter.sendMail({
        from: configuration.sender,
        to: message.to.join(", "),
        replyTo: configuration.replyTo,
        subject: message.subject,
        text: message.text,
        html: message.html,
        headers: { "X-ASAS-Organization": message.organizationId, "X-ASAS-Idempotency-Key": message.idempotencyKey },
      });
      if (!result.messageId) throw new MailTransportError("PROVIDER_REJECTED");
      return { providerMessageId: result.messageId };
    },
  });
}

export async function installSmtpTransportFromEnvironment() {
  const path = process.env.ASAS_MAIL_TRANSPORT_CONFIG_PATH;
  if (!path || mailTransportInstalled()) return false;
  installMailTransport(createSmtpTransport(await loadRootOnlySmtpTransportConfiguration(path)));
  return true;
}
