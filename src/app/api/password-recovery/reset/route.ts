import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PasswordRecoveryService } from "@/lib/password-recovery";

const noMailer = { async send() { throw new Error("RECOVERY_MAIL_NOT_AVAILABLE_ON_RESET"); } };
const noOrigin = "https://asasplus.shop";

export async function POST(request: NextRequest) {
  try {
    const input = await request.json();
    const store = {
      async issue() { throw new Error("RECOVERY_RESET_STORE_ONLY"); },
      async consume(payload: { tokenHash: string; passwordHash: string }) {
        const rows = await prisma.$queryRaw<Array<{ user_id: string; auth_version: number }>>`
          SELECT * FROM control.consume_password_recovery(${payload.tokenHash}, ${payload.passwordHash})
        `;
        const row = rows[0];
        return row ? { userId: row.user_id, authVersion: row.auth_version } : null;
      },
    };
    const audit = { async record(event: { action: string; outcome: string; userFingerprint?: string }) { await prisma.$executeRaw`SELECT control.record_password_recovery_audit(${event.action}, ${event.outcome}, ${event.userFingerprint ?? null})`; } };
    const result = await new PasswordRecoveryService(store, noMailer, audit, noOrigin).reset(input);
    if (!result.success) return NextResponse.json({ error: "رابط الاستعادة غير صالح أو انتهت صلاحيته" }, { status: 400 });
    return NextResponse.json({ message: "تم تغيير كلمة المرور. سجّل الدخول بكلمة المرور الجديدة." });
  } catch {
    return NextResponse.json({ error: "تعذر إتمام الاستعادة. تحقق من البيانات وحاول مرة أخرى." }, { status: 400 });
  }
}
