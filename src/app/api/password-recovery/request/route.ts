import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { MailDispatchService } from "@/lib/mail-transport";
import { PASSWORD_RECOVERY_GENERIC_MESSAGE, PasswordRecoveryService } from "@/lib/password-recovery";
import { installSmtpTransportFromEnvironment, loadPasswordRecoveryMailConfiguration } from "@/lib/smtp-transport";

const origin = process.env.ASAS_PASSWORD_RECOVERY_ORIGIN ?? process.env.AUTH_URL ?? "";
const platformMailScope = "platform_recovery";

function recoveryService() {
  const store = {
    async issue(input: { email: string; tokenHash: string; recoveryId: string; expiresAt: Date }) {
      const rows = await prisma.$queryRaw<Array<{ user_id: string; recipient_email: string; recovery_id: string }>>`
        SELECT * FROM control.issue_password_recovery(${input.email}, ${input.tokenHash}, ${input.recoveryId}, ${input.expiresAt})
      `;
      const row = rows[0];
      return row ? { userId: row.user_id, recipientEmail: row.recipient_email, recoveryId: row.recovery_id } : null;
    },
    async consume() { throw new Error("RECOVERY_REQUEST_STORE_ONLY"); },
  };
  const mailer = {
    async send(input: { to: string; subject: string; text: string; html: string; idempotencyKey: string }) {
      await installSmtpTransportFromEnvironment();
      const configuration = await loadPasswordRecoveryMailConfiguration();
      const dispatch = new MailDispatchService(undefined, process.env.ASAS_PASSWORD_RECOVERY_DELIVERY_ENABLED === "true");
      await dispatch.deliver({ organizationId: platformMailScope, to: [input.to], subject: input.subject, text: input.text, html: input.html, idempotencyKey: input.idempotencyKey }, configuration);
    },
  };
  const audit = { async record(event: { action: string; outcome: string; userFingerprint?: string }) { await prisma.$executeRaw`SELECT control.record_password_recovery_audit(${event.action}, ${event.outcome}, ${event.userFingerprint ?? null})`; } };
  return new PasswordRecoveryService(store, mailer, audit, origin);
}

export async function POST(request: NextRequest) {
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ message: PASSWORD_RECOVERY_GENERIC_MESSAGE }); }
  // Response stays uniform; asynchronous delivery does not change enumeration behavior.
  setImmediate(() => {
    void recoveryService().request(input).catch((error) => logger.warn("Password recovery request processing failed", {
      failureClass: error instanceof Error ? error.name : "Unknown",
      failureCode: typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : "NONE",
    }));
  });
  return NextResponse.json({ message: PASSWORD_RECOVERY_GENERIC_MESSAGE });
}
