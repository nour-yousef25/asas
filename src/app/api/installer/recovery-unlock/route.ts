import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isRecoveryUnlockAuthorized } from "@/lib/installer/authorization";
import { unlockInstallerForRecovery } from "@/lib/installer/state";
import { getRuntimeConfig } from "@/lib/platform/runtime-config";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const timestamp = request.headers.get("x-asas-recovery-timestamp");
  const signature = request.headers.get("x-asas-recovery-signature");
  if (!isRecoveryUnlockAuthorized(timestamp, signature)) {
    return apiError("توقيع الاسترداد غير صالح أو منتهي.", 401);
  }

  try {
    const state = await unlockInstallerForRecovery(getRuntimeConfig().ASAS_RELEASE_VERSION);
    return apiSuccess({ status: state.status, recoveryUnlockExpiresAt: state.recoveryUnlockExpiresAt });
  } catch {
    return apiError("تعذر فتح المثبت لمسار الاسترداد.", 500);
  }
}
