import type { PrismaClient } from "@prisma/client";
import type { TenantContext } from "@/lib/tenant-context";
import { requireTenantBoundPrismaExecutor, type TenantBoundPrismaExecutor } from "@/lib/tenant-bound-prisma-authority";

export type DashboardSnapshot = Readonly<{
  totalDonations: number;
  activeMembers: number;
  totalMembers: number;
  activeBeneficiaries: number;
  activeProjects: number;
  completedProjects: number;
  recentDonations: ReadonlyArray<{ id: string; amount: number; createdAt: Date; guestName: string | null; donorName: string | null; projectTitle: string | null; campaignTitle: string | null }>;
  projects: ReadonlyArray<{ id: string; title: string; collectedAmount: number; targetAmount: number; completionPercent: number }>;
  kpis: ReadonlyArray<{ id: string; latestPercent: number }>;
}>;

/** Tenant data-plane dashboard repository. It never imports global Prisma. */
export class DashboardRepository {
  constructor(private readonly executor?: TenantBoundPrismaExecutor) {}

  private execute<T>(context: TenantContext, operation: (db: PrismaClient) => Promise<T>) {
    return (this.executor ?? requireTenantBoundPrismaExecutor()).execute(context, operation);
  }

  async getSnapshot(context: TenantContext): Promise<DashboardSnapshot> {
    return this.execute(context, async (db) => {
      const organizationId = context.organizationId;
      const [totalDonations, activeMembers, totalMembers, activeBeneficiaries, activeProjects, completedProjects, recentDonations, projects, kpis] = await Promise.all([
        db.donation.aggregate({ where: { organizationId, status: "COMPLETED" }, _sum: { amount: true } }),
        db.member.count({ where: { organizationId, status: "ACTIVE" } }),
        db.member.count({ where: { organizationId } }),
        db.beneficiary.count({ where: { organizationId, status: "ACTIVE" } }),
        db.project.count({ where: { organizationId, status: "ACTIVE" } }),
        db.project.count({ where: { organizationId, status: "COMPLETED" } }),
        db.donation.findMany({
          where: { organizationId, status: "COMPLETED" },
          include: {
            donor: { select: { name: true, organizationId: true } },
            project: { select: { title: true, organizationId: true } },
            campaign: { select: { title: true, organizationId: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        db.project.findMany({ where: { organizationId, status: { in: ["ACTIVE", "PLANNING"] } }, orderBy: { completionPercent: "desc" }, take: 4, select: { id: true, title: true, collectedAmount: true, targetAmount: true, completionPercent: true } }),
        db.kPI.findMany({ where: { organizationId, status: "ACTIVE" }, take: 6, select: { id: true, records: { where: { organizationId }, orderBy: { period: "desc" }, take: 1, select: { percent: true } } } }),
      ]);
      return {
        totalDonations: totalDonations._sum.amount ?? 0,
        activeMembers,
        totalMembers,
        activeBeneficiaries,
        activeProjects,
        completedProjects,
        recentDonations: recentDonations.map((donation) => ({
          id: donation.id,
          amount: donation.amount,
          createdAt: donation.createdAt,
          guestName: donation.guestName,
          donorName: donation.donor?.organizationId === organizationId ? donation.donor.name : null,
          projectTitle: donation.project?.organizationId === organizationId ? donation.project.title : null,
          campaignTitle: donation.campaign?.organizationId === organizationId ? donation.campaign.title : null,
        })),
        projects,
        kpis: kpis.map((kpi) => ({ id: kpi.id, latestPercent: kpi.records[0]?.percent ?? 0 })),
      };
    });
  }
}

export const dashboardRepository = new DashboardRepository();
