import { PasswordRecoveryService, PASSWORD_RECOVERY_GENERIC_MESSAGE, createPasswordRecoveryToken, passwordRecoveryLink } from "@/lib/password-recovery";

const future = new Date("2026-08-26T00:00:00.000Z");
function harness() {
  const issued: Array<{ email: string; tokenHash: string; expiresAt: Date; consumed: boolean; userId: string }> = [];
  const sent: Array<{ to: string; html: string }> = [];
  const audits: unknown[] = [];
  const service = new PasswordRecoveryService({
    async issue(input) { if (input.email === "unknown@example.com") return null; const record = { ...input, consumed: false, userId: input.email === "second@example.com" ? "user-second" : "user-first" }; issued.push(record); return { userId: record.userId, recipientEmail: input.email, recoveryId: input.recoveryId }; },
    async consume(input) { const record = issued.find((entry) => entry.tokenHash === input.tokenHash && !entry.consumed && entry.expiresAt > future); if (!record) return null; record.consumed = true; return { userId: record.userId, authVersion: 2 }; },
  }, { async send(input) { sent.push({ to: input.to, html: input.html }); } }, { async record(event) { audits.push(event); } }, "https://asasplus.shop", () => future);
  return { service, issued, sent, audits };
}

describe("Password Recovery", () => {
  it("returns the same public message for existing and unknown accounts", async () => {
    const { service, sent } = harness();
    const known = await service.request({ email: "known@example.com" });
    const unknown = await service.request({ email: "unknown@example.com" });
    expect(known.message).toBe(PASSWORD_RECOVERY_GENERIC_MESSAGE);
    expect(unknown.message).toBe(PASSWORD_RECOVERY_GENERIC_MESSAGE);
    expect(sent).toHaveLength(1);
  });

  it("uses a fragment-only single-use token and increments the returned auth version once", async () => {
    const { service, sent } = harness();
    await service.request({ email: "known@example.com" });
    const token = new URL(sent[0].html.match(/href="([^"]+)"/)![1]).hash.replace("#token=", "");
    expect(sent[0].html).toContain("#token=");
    await expect(service.reset({ token: decodeURIComponent(token), password: "NewPassword2026" })).resolves.toEqual({ success: true, authVersion: 2 });
    await expect(service.reset({ token: decodeURIComponent(token), password: "NewPassword2026" })).resolves.toEqual({ success: false });
  });

  it("denies wrong and expired tokens without selecting another user", async () => {
    const { service, issued } = harness();
    const wrong = createPasswordRecoveryToken();
    await expect(service.reset({ token: wrong.token, password: "NewPassword2026" })).resolves.toEqual({ success: false });
    issued.push({ email: "known@example.com", tokenHash: wrong.tokenHash, expiresAt: new Date("2026-08-25T23:59:59.000Z"), consumed: false, userId: "user-first" });
    await expect(service.reset({ token: wrong.token, password: "NewPassword2026" })).resolves.toEqual({ success: false });
  });

  it("uses the established password policy and an origin without a query or fragment", async () => {
    const { service } = harness();
    await expect(service.reset({ token: createPasswordRecoveryToken().token, password: "weakpassword" })).rejects.toThrow("حرفاً كبيراً");
    expect(() => passwordRecoveryLink("https://asasplus.shop?x=1", createPasswordRecoveryToken().token)).toThrow("PASSWORD_RECOVERY_ORIGIN_INVALID");
  });
});
