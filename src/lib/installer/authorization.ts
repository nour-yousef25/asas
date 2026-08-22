/**
 * W01 INST-001 — تحقق خادمي من دخول installer والاسترداد الموقع.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function matchesSecret(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

export function isInstallerAccessAuthorized(provided: string | null): boolean {
  return matchesSecret(provided, process.env.ASAS_INSTALLER_ACCESS_TOKEN);
}

export function isRecoveryUnlockAuthorized(timestamp: string | null, signature: string | null, now = Date.now()): boolean {
  const secret = process.env.ASAS_INSTALLER_RECOVERY_SECRET;
  if (!timestamp || !signature || !secret) return false;

  const numericTimestamp = Number(timestamp);
  if (!Number.isInteger(numericTimestamp) || Math.abs(now - numericTimestamp) > 5 * 60 * 1000) return false;

  const expected = createHmac("sha256", secret).update(`asas-installer-recovery:${timestamp}`).digest("hex");
  return matchesSecret(signature, expected);
}
