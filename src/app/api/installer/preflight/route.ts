import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isInstallerAccessAuthorized } from "@/lib/installer/authorization";
import { collectPreflightReport } from "@/lib/installer/preflight";
import { assertInstallerAvailable, recordPreflightSuccess } from "@/lib/installer/state";
import { getRuntimeConfig } from "@/lib/platform/runtime-config";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isInstallerAccessAuthorized(request.headers.get("x-asas-installer-token"))) {
    return apiError("مسار فحص المثبت غير مصرح.", 401);
  }

  try {
    await assertInstallerAvailable();
    const report = await collectPreflightReport();
    if (report.ready) await recordPreflightSuccess(getRuntimeConfig().ASAS_RELEASE_VERSION);

    const download = request.nextUrl.searchParams.get("download") === "1";
    const response = apiSuccess(report, report.ready ? 200 : 503);
    if (download) response.headers.set("content-disposition", 'attachment; filename="asas-preflight-report.json"');
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "تعذر تنفيذ فحوص المثبت.", 409);
  }
}
