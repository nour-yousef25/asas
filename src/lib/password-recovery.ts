import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { passwordPolicySchema } from "@/lib/validations";

export const PASSWORD_RECOVERY_GENERIC_MESSAGE = "إذا كان الحساب موجوداً، فستصلك تعليمات الاستعادة.";
export const PASSWORD_RECOVERY_TOKEN_TTL_MS = 15 * 60_000;
export const passwordRecoveryPasswordSchema = passwordPolicySchema;
const emailSchema = z.string().trim().email().max(320).transform((value) => value.toLowerCase());
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export type PasswordRecoveryIssue = Readonly<{ userId: string; recipientEmail: string; recoveryId: string }>;
export type PasswordRecoveryConsume = Readonly<{ userId: string; authVersion: number }>;
export type PasswordRecoveryStore = Readonly<{
  issue(input: Readonly<{ email: string; tokenHash: string; recoveryId: string; expiresAt: Date }>): Promise<PasswordRecoveryIssue | null>;
  consume(input: Readonly<{ tokenHash: string; passwordHash: string }>): Promise<PasswordRecoveryConsume | null>;
}>;
export type PasswordRecoveryMailer = Readonly<{ send(input: Readonly<{ to: string; subject: string; text: string; html: string; idempotencyKey: string }>): Promise<void> }>;
export type PasswordRecoveryAudit = Readonly<{ record(input: Readonly<{ action: "PASSWORD_RECOVERY_REQUESTED" | "PASSWORD_RECOVERY_RESET" | "PASSWORD_RECOVERY_DELIVERY_FAILED"; outcome: "ISSUED" | "RESET" | "FAILED"; userFingerprint?: string }>): Promise<void> }>;

export function passwordRecoveryTokenHash(token: string) {
  return createHash("sha256").update(`asas-password-recovery:v1:${tokenSchema.parse(token)}`).digest("base64url");
}

function userFingerprint(userId: string) {
  return createHash("sha256").update(`asas-password-recovery-audit:v1:${userId}`).digest("base64url");
}

export function createPasswordRecoveryToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: passwordRecoveryTokenHash(token) };
}

function createRecoveryId() { return `pr_${randomBytes(18).toString("hex")}`; }

export function passwordRecoveryLink(origin: string, token: string) {
  const parsed = new URL(origin);
  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("PASSWORD_RECOVERY_ORIGIN_INVALID");
  parsed.pathname = "/reset-password";
  // The fragment is never included in HTTP requests or ordinary web-server access logs.
  parsed.hash = `token=${encodeURIComponent(tokenSchema.parse(token))}`;
  return parsed.toString();
}

export function passwordRecoveryEmail(link: string) {
  return {
    subject: "استعادة كلمة المرور | School Screen",
    text: `وصلنا طلباً لاستعادة كلمة المرور. استخدم الرابط التالي خلال 15 دقيقة ولا تشاركه مع أي شخص:\n${link}\n\nإذا لم تطلب الاستعادة، فتجاهل هذه الرسالة.`,
    html: `<main dir="rtl"><h1>School Screen</h1><p>وصلنا طلباً لاستعادة كلمة المرور.</p><p><a href="${link}">إعادة تعيين كلمة المرور</a></p><p>ينتهي الرابط خلال 15 دقيقة. لا تشاركه مع أي شخص.</p><p>إذا لم تطلب الاستعادة، فتجاهل هذه الرسالة.</p></main>`,
  };
}

export class PasswordRecoveryService {
  constructor(private readonly store: PasswordRecoveryStore, private readonly mailer: PasswordRecoveryMailer, private readonly audit: PasswordRecoveryAudit, private readonly origin: string, private readonly now: () => Date = () => new Date()) {}

  async request(input: unknown) {
    const email = emailSchema.parse((input as { email?: unknown }).email);
    const { token, tokenHash } = createPasswordRecoveryToken();
    const issued = await this.store.issue({ email, tokenHash, recoveryId: createRecoveryId(), expiresAt: new Date(this.now().getTime() + PASSWORD_RECOVERY_TOKEN_TTL_MS) });
    if (!issued) return { message: PASSWORD_RECOVERY_GENERIC_MESSAGE, queued: false };
    try {
      const link = passwordRecoveryLink(this.origin, token);
      const message = passwordRecoveryEmail(link);
      await this.mailer.send({ to: issued.recipientEmail, ...message, idempotencyKey: `password-recovery:${issued.recoveryId}` });
      await this.audit.record({ action: "PASSWORD_RECOVERY_REQUESTED", outcome: "ISSUED", userFingerprint: userFingerprint(issued.userId) });
    } catch {
      await this.audit.record({ action: "PASSWORD_RECOVERY_DELIVERY_FAILED", outcome: "FAILED", userFingerprint: userFingerprint(issued.userId) });
    }
    return { message: PASSWORD_RECOVERY_GENERIC_MESSAGE, queued: true };
  }

  async reset(input: unknown) {
    const payload = z.object({ token: tokenSchema, password: passwordRecoveryPasswordSchema }).parse(input);
    const passwordHash = await bcrypt.hash(payload.password, 12);
    const consumed = await this.store.consume({ tokenHash: passwordRecoveryTokenHash(payload.token), passwordHash });
    if (!consumed) return { success: false };
    await this.audit.record({ action: "PASSWORD_RECOVERY_RESET", outcome: "RESET", userFingerprint: userFingerprint(consumed.userId) });
    return { success: true, authVersion: consumed.authVersion };
  }
}
