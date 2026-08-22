import { NextResponse } from "next/server";
import { withTenantContext } from "@/lib/tenant-api";

export async function GET() {
  return withTenantContext(async (context) => ({
    organizationId: context.organizationId,
    membershipId: context.membershipId,
    policySnapshotVersion: context.policySnapshotVersion,
    correlationId: context.correlationId,
  }));
}
