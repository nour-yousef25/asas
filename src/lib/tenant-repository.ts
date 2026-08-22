import type { TenantContext } from "@/lib/tenant-context";

/**
 * WP1 repository boundary. Tenant-scoped repositories must accept this context
 * and must never derive organizationId from a business payload.
 */
export interface TenantScopedRepository<TCreate, TUpdate, TResult> {
  list(context: TenantContext): Promise<TResult[]>;
  getById(context: TenantContext, id: string): Promise<TResult | null>;
  create(context: TenantContext, input: TCreate): Promise<TResult>;
  update(context: TenantContext, id: string, input: TUpdate): Promise<TResult>;
  deleteOrArchive(context: TenantContext, id: string): Promise<TResult>;
}

export function tenantWhere(context: TenantContext) {
  return Object.freeze({ organizationId: context.organizationId });
}
