import type { PrismaClient, Role } from "@prisma/client";
import type { TenantContext } from "@/lib/tenant-context";
import { requireTenantBoundPrismaExecutor, type TenantBoundPrismaExecutor } from "@/lib/tenant-bound-prisma-authority";

export class MembershipScopeError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "ALREADY_EXISTS") {
    super(code);
    this.name = "MembershipScopeError";
  }
}

/** Tenant membership data-plane. User remains global identity and is never organization-filtered. */
export class MembershipRepository {
  constructor(private readonly executor?: TenantBoundPrismaExecutor) {}

  private execute<T>(context: TenantContext, operation: (db: PrismaClient) => Promise<T>) {
    return (this.executor ?? requireTenantBoundPrismaExecutor()).execute(context, operation);
  }

  list(context: TenantContext, input: { skip: number; take: number; search?: string }) {
    const where = {
      organizationId: context.organizationId,
      ...(input.search ? { user: { OR: ["name", "email", "phone"].map((field) => ({ [field]: { contains: input.search, mode: "insensitive" as const } })) } } : {}),
    };
    return this.execute(context, async (db) => {
      const [data, total] = await db.$transaction([
        db.organizationMembership.findMany({ where, skip: input.skip, take: input.take, orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, name: true, email: true, phone: true, isActive: true } }, organizationRoles: { include: { organizationRole: true } } } }),
        db.organizationMembership.count({ where }),
      ]);
      return { data, total };
    });
  }

  getById(context: TenantContext, membershipId: string) {
    return this.execute(context, (db) => db.organizationMembership.findFirst({
      where: { id: membershipId, organizationId: context.organizationId },
      include: { user: { select: { id: true, name: true, email: true, phone: true, isActive: true } }, organizationRoles: { include: { organizationRole: true } } },
    }));
  }

  async create(context: TenantContext, input: { userId: string; role?: Role }) {
    return this.execute(context, async (db) => {
      const user = await db.user.findUnique({ where: { id: input.userId }, select: { id: true, isActive: true } });
      if (!user?.isActive) throw new MembershipScopeError("NOT_FOUND");
      const existing = await db.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: context.organizationId, userId: user.id } }, select: { id: true } });
      if (existing) throw new MembershipScopeError("ALREADY_EXISTS");
      return db.organizationMembership.create({ data: { organizationId: context.organizationId, userId: user.id, role: input.role ?? "MEMBER" }, include: { user: { select: { id: true, name: true, email: true, phone: true, isActive: true } } } });
    });
  }

  async revoke(context: TenantContext, membershipId: string) {
    return this.execute(context, async (db) => {
      const membership = await db.organizationMembership.findFirst({ where: { id: membershipId, organizationId: context.organizationId, isActive: true, revokedAt: null }, select: { id: true } });
      if (!membership) throw new MembershipScopeError("NOT_FOUND");
      return db.organizationMembership.update({ where: { id: membership.id }, data: { isActive: false, revokedAt: new Date(), policyVersion: { increment: 1 } } });
    });
  }
}

export const membershipRepository = new MembershipRepository();
