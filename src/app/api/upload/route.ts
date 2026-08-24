import { NextResponse } from "next/server";

/** Legacy raw upload accepted caller-selected paths and returned public URLs. */
export async function POST() {
  return NextResponse.json({ error: "LEGACY_UPLOAD_SURFACE_QUARANTINED", message: "استخدم واجهة المستندات الخاصة المقيدة بالمنظمة" }, { status: 410 });
}
