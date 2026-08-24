import { NextResponse } from "next/server";

const quarantined = () => NextResponse.json(
  { success: false, error: "مسار SMS محجور حتى يثبت ownership منظمة وprovider tenant-bound.", code: "QUEUE_LEGACY_SURFACE_QUARANTINED" },
  { status: 410 },
);

export async function GET() {
  return quarantined();
}

export async function POST() {
  return quarantined();
}
