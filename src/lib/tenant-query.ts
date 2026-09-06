import { NextResponse } from "next/server";
import type { PrismaClient } from "@prisma/client";
import {
  requireTenantContext,
  TenantAuthorizationError,
  type ResolvedTenantContext,
} from "@/lib/tenant-context";
import { PolicyAuthorizationError, requirePermission } from "@/lib/policy";
import { requireTenantBoundPrismaExecutor } from "@/lib/tenant-bound-prisma-authority";

/**
 * Tenant-scoped data access helpers.
 *
 * Every call resolves the trusted tenant from the authenticated session
 * (never from request input), optionally enforces a W02 permission, and runs
 * the query through the tenant-bound executor so the connection, lease, and
 * RLS organization are all derived from context.organizationId.
 */

/** Server Component path: fails closed by throwing on missing tenant context. */
export async function queryTenant<T>(
  operation: (db: PrismaClient, context: ResolvedTenantContext) => Promise<T>,
  permission?: string,
): Promise<T> {
  const context = await requireTenantContext();
  if (permission) await requirePermission(context, permission);
  return requireTenantBoundPrismaExecutor().execute(context, (db) =>
    operation(db, context),
  );
}

/**
 * API route path: returns a 401/403 NextResponse instead of throwing when the
 * caller has no active tenant membership or lacks the required permission.
 * Callers must check the result with isTenantApiError before using it.
 */
export async function queryTenantApi<T>(
  operation: (db: PrismaClient, context: ResolvedTenantContext) => Promise<T>,
  permission?: string,
): Promise<T | NextResponse> {
  let context: ResolvedTenantContext;
  try {
    context = await requireTenantContext();
    if (permission) await requirePermission(context, permission);
  } catch (error) {
    if (error instanceof TenantAuthorizationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "UNAUTHENTICATED" ? 401 : 403 },
      );
    }
    if (error instanceof PolicyAuthorizationError) {
      return NextResponse.json(
        { error: "ليس لديك صلاحية للوصول إلى هذا المورد." },
        { status: 403 },
      );
    }
    throw error;
  }
  return requireTenantBoundPrismaExecutor().execute(context, (db) =>
    operation(db, context),
  );
}

export function isTenantApiError(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
