import type { PrismaClient } from "@prisma/client";
import type { TenantContext } from "@/lib/tenant-context";
import { requireTenantBoundPrismaExecutor, type TenantBoundPrismaExecutor } from "@/lib/tenant-bound-prisma-authority";

export class MemberKpiScopeError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "FORBIDDEN_RELATION") { super(code); this.name = "MemberKpiScopeError"; }
}

/** Tenant data-plane repository for Member/KPI roots and KPIRecord children. Never imports global Prisma. */
export class MemberKpiRepository {
  constructor(private readonly executor?: TenantBoundPrismaExecutor) {}
  private execute<T>(context: TenantContext, operation: (db: PrismaClient) => Promise<T>) { return (this.executor ?? requireTenantBoundPrismaExecutor()).execute(context, operation); }

  listMembers(context: TenantContext, input: { skip: number; take: number; search?: string }) {
    const where = { organizationId: context.organizationId, ...(input.search ? { user: { OR: ["name", "phone", "email"].map((field) => ({ [field]: { contains: input.search, mode: "insensitive" as const } })) } } : {}) };
    return this.execute(context, (db) => db.$transaction([db.member.findMany({ where, skip: input.skip, take: input.take, orderBy: { createdAt: "desc" }, include: { user: true, payments: { orderBy: { createdAt: "desc" }, take: 10 } } }), db.member.count({ where })]).then(([data, total]) => ({ data, total })));
  }
  getMember(context: TenantContext, id: string) { return this.execute(context, (db) => db.member.findFirst({ where: { id, organizationId: context.organizationId }, include: { user: true, payments: { orderBy: { createdAt: "desc" } } } })); }
  async renewMember(context: TenantContext, id: string, input: { amount: number; paymentMethod?: string | null; receiptNo: string; now?: Date }) {
    const member = await this.execute(context, (db) => db.member.findFirst({ where: { id, organizationId: context.organizationId } }));
    if (!member) throw new MemberKpiScopeError("NOT_FOUND");
    const now = input.now ?? new Date();
    const endDate = member.endDate ? new Date(Math.max(member.endDate.getTime(), now.getTime()) + 365 * 24 * 60 * 60 * 1000) : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    return this.execute(context, (db) => db.$transaction(async (tx) => {
      const payment = await tx.membershipPayment.create({ data: { memberId: member.id, amount: input.amount, paymentMethod: input.paymentMethod, receiptNo: input.receiptNo, status: "PAID", paidAt: now } });
      await tx.member.updateMany({ where: { id: member.id, organizationId: context.organizationId }, data: { paidAmount: member.paidAmount + input.amount, paymentStatus: member.membershipFee <= member.paidAmount + input.amount ? "PAID" : "PARTIAL", endDate, status: "ACTIVE" } });
      return payment;
    }));
  }
  async createMember(context: TenantContext, input: { userId: string; membershipType?: never; membershipFee?: number; paidAmount?: number; endDate?: Date; status?: never; paymentStatus?: never }) {
    const membership = await this.execute(context, (db) => db.organizationMembership.findFirst({ where: { userId: input.userId, organizationId: context.organizationId, isActive: true, revokedAt: null }, select: { id: true } }));
    if (!membership) throw new MemberKpiScopeError("FORBIDDEN_RELATION");
    return this.execute(context, (db) => db.member.create({ data: { userId: input.userId, organizationId: context.organizationId, membershipFee: input.membershipFee ?? 0, paidAmount: input.paidAmount ?? 0, endDate: input.endDate, }, include: { user: true, payments: true } }));
  }
  listKpis(context: TenantContext) { return this.execute(context, (db) => db.kPI.findMany({ where: { organizationId: context.organizationId }, include: { records: { where: { organizationId: context.organizationId }, orderBy: { period: "desc" } } }, orderBy: { createdAt: "desc" } })); }
  createKpi(context: TenantContext, input: Omit<Parameters<PrismaClient["kPI"]["create"]>[0]["data"], "organizationId" | "organization">) { return this.execute(context, (db) => db.kPI.create({ data: { ...input, organizationId: context.organizationId } })); }
  async addKpiRecord(context: TenantContext, input: { kpiId: string; period: string; actualValue: number; targetValue: number; notes?: string | null }) {
    const kpi = await this.execute(context, (db) => db.kPI.findFirst({ where: { id: input.kpiId, organizationId: context.organizationId }, select: { id: true } }));
    if (!kpi) throw new MemberKpiScopeError("NOT_FOUND");
    const percent = input.targetValue > 0 ? Math.round((input.actualValue / input.targetValue) * 100) : 0;
    return this.execute(context, (db) => db.$transaction(async (tx) => {
      const record = await tx.kPIRecord.create({ data: { ...input, kpiId: kpi.id, organizationId: context.organizationId, percent } });
      await tx.kPI.updateMany({ where: { id: kpi.id, organizationId: context.organizationId }, data: { status: percent >= 100 ? "ACHIEVED" : percent < 50 ? "BEHIND" : "ACTIVE" } });
      return record;
    }));
  }
}
export const memberKpiRepository = new MemberKpiRepository();
