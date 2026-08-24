import { NextResponse } from "next/server";

/**
 * W02 authority boundary: User is a global identity and this former auth-only
 * endpoint had neither a product-approved control-plane entitlement nor a
 * tenant-bound authority chain. It is deliberately quarantined rather than
 * tenant-filtered, because neither an active organization nor a first
 * membership may grant authority over global identities.
 */
const QUARANTINED_USERS_SURFACE = "سطح الهويات العالمي معزول حتى اعتماد عقد control-plane صريح.";

function quarantinedResponse() {
  return NextResponse.json(
    { success: false, error: QUARANTINED_USERS_SURFACE, code: "GLOBAL_IDENTITY_SURFACE_QUARANTINED" },
    { status: 410 },
  );
}

export async function GET() {
  return quarantinedResponse();
}

export async function POST() {
  return quarantinedResponse();
}
