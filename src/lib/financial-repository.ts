import type { CampaignStatus, DonorStatus, DonorType, PrismaClient, ProjectStatus } from "@prisma/client";
import type { TenantContext } from "@/lib/tenant-context";
import { requireTenantBoundPrismaExecutor, type TenantBoundPrismaExecutor } from "@/lib/tenant-bound-prisma-authority";

type DonorInput = { name: string; phone?: string; email?: string; address?: string; donorType?: DonorType; status?: DonorStatus };
type CampaignInput = { title: string; description?: string; imageUrl?: string; targetAmount: number; startDate: Date; endDate?: Date | null; status?: CampaignStatus };
type ProjectInput = { title: string; description?: string; imageUrl?: string; targetAmount: number; startDate: Date; endDate?: Date; status?: ProjectStatus; category?: string; location?: string };

export class FinancialScopeError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "FORBIDDEN_RELATION", message: string) { super(message); this.name = "FinancialScopeError"; }
}

/** Tenant data-plane repository. It never imports the global Prisma client. */
export class FinancialRepository {
  constructor(private readonly executor?: TenantBoundPrismaExecutor) {}

  private execute<T>(context: TenantContext, operation: (db: PrismaClient) => Promise<T>) {
    return (this.executor ?? requireTenantBoundPrismaExecutor()).execute(context, operation);
  }

  private async auditDenied(context: TenantContext, action: string, entity: string, entityId: string) {
    await this.execute(context, (db) => db.auditLog.create({ data: { organizationId: context.organizationId, userId: context.userId, action, entity, entityId, details: { actorMembershipId: context.membershipId, decision: "DENY", reasonCode: "TENANT_SCOPE", correlationId: context.correlationId, source: "financial-repository" } } }));
  }

  listDonors(context: TenantContext) {
    return this.execute(context, (db) => db.donor.findMany({ where: { organizationId: context.organizationId }, include: { donations: { where: { status: "COMPLETED" }, select: { amount: true, createdAt: true } }, communications: { orderBy: { createdAt: "desc" }, take: 5 } }, orderBy: { totalDonations: "desc" } }));
  }

  async getDonorById(context: TenantContext, id: string) {
    const donor = await this.execute(context, (db) => db.donor.findFirst({ where: { id, organizationId: context.organizationId }, include: { donations: { include: { project: { select: { title: true } }, campaign: { select: { title: true } } }, orderBy: { createdAt: "desc" } }, communications: { orderBy: { createdAt: "desc" } } } }));
    if (!donor) await this.auditDenied(context, "TENANT_DONOR_READ_DENIED", "Donor", id);
    return donor;
  }

  createDonor(context: TenantContext, input: DonorInput) {
    return this.execute(context, (db) => db.donor.create({ data: { ...input, organizationId: context.organizationId } }));
  }

  async addDonorCommunication(context: TenantContext, donorId: string, input: { type?: string; subject?: string; notes?: string }) {
    const donor = await this.execute(context, (db) => db.donor.findFirst({ where: { id: donorId, organizationId: context.organizationId }, select: { id: true } }));
    if (!donor) { await this.auditDenied(context, "TENANT_DONOR_CHILD_WRITE_DENIED", "Donor", donorId); return null; }
    return this.execute(context, (db) => db.donorCommunication.create({ data: { donorId: donor.id, type: input.type ?? "NOTE", subject: input.subject, notes: input.notes ?? "" } }));
  }

  listCampaigns(context: TenantContext, status?: string | null) {
    return this.execute(context, (db) => db.donationCampaign.findMany({ where: { organizationId: context.organizationId, ...(status ? { status: status as never } : {}) }, orderBy: { displayOrder: "asc" } }));
  }

  getCampaignById(context: TenantContext, id: string) {
    return this.execute(context, (db) => db.donationCampaign.findFirst({ where: { id, organizationId: context.organizationId } }));
  }

  createCampaign(context: TenantContext, input: CampaignInput) {
    return this.execute(context, (db) => db.donationCampaign.create({ data: { ...input, organizationId: context.organizationId } }));
  }

  getProjectById(context: TenantContext, id: string) {
    return this.execute(context, (db) => db.project.findFirst({ where: { id, organizationId: context.organizationId } }));
  }

  listProjects(context: TenantContext, status?: string | null) {
    return this.execute(context, (db) => db.project.findMany({ where: { organizationId: context.organizationId, ...(status ? { status: status as ProjectStatus } : {}) }, orderBy: { createdAt: "desc" } }));
  }

  async getProjectDetail(context: TenantContext, id: string) {
    const project = await this.execute(context, (db) => db.project.findFirst({ where: { id, organizationId: context.organizationId }, include: { donations: { where: { status: "COMPLETED" }, select: { id: true, amount: true, createdAt: true, donorId: true, isGuest: true, guestName: true, paymentMethod: true, status: true }, take: 50 }, creator: { select: { name: true } } } }));
    if (!project) await this.auditDenied(context, "TENANT_PROJECT_READ_DENIED", "Project", id);
    return project;
  }

  createProject(context: TenantContext, input: ProjectInput) {
    return this.execute(context, (db) => db.project.create({ data: { ...input, creatorId: context.userId, organizationId: context.organizationId } }));
  }

  async updateProject(context: TenantContext, id: string, input: Partial<ProjectInput>) {
    const project = await this.execute(context, (db) => db.project.findFirst({ where: { id, organizationId: context.organizationId }, select: { id: true } }));
    if (!project) { await this.auditDenied(context, "TENANT_PROJECT_UPDATE_DENIED", "Project", id); return null; }
    return this.execute(context, (db) => db.project.update({ where: { id: project.id }, data: input }));
  }

  async deleteProject(context: TenantContext, id: string) {
    const result = await this.execute(context, (db) => db.project.deleteMany({ where: { id, organizationId: context.organizationId } }));
    if (result.count !== 1) await this.auditDenied(context, "TENANT_PROJECT_DELETE_DENIED", "Project", id);
    return result.count === 1;
  }

  async listDonations(context: TenantContext, input: { skip: number; take: number; search?: string; status?: string | null }) {
    const where = { organizationId: context.organizationId, ...(input.status ? { status: input.status as never } : {}), ...(input.search ? { OR: ["guestName", "guestPhone", "guestEmail", "paymentMethod"].map((field) => ({ [field]: { contains: input.search, mode: "insensitive" as const } })) } : {}) };
    return this.execute(context, (db) => db.$transaction([db.donation.findMany({ where, skip: input.skip, take: input.take, orderBy: { createdAt: "desc" }, include: { donor: { select: { id: true, name: true, phone: true } }, project: { select: { title: true } }, campaign: { select: { title: true } }, invoice: true } }), db.donation.count({ where })]).then(([data, total]) => ({ data, total })));
  }

  async getDonationById(context: TenantContext, id: string) {
    const donation = await this.execute(context, (db) => db.donation.findFirst({ where: { id, organizationId: context.organizationId }, include: { invoice: true, donor: true, project: true, campaign: true } }));
    if (!donation) await this.auditDenied(context, "TENANT_DONATION_READ_DENIED", "Donation", id);
    return donation;
  }

  async createDonation(context: TenantContext, input: { amount: number; paymentMethod: string; paymentRef: string; isAnonymous?: boolean; isGuest?: boolean; guestName?: string; guestPhone?: string; guestEmail?: string; donorId?: string; campaignId?: string; projectId?: string; invoiceNo: string; taxNumber: string }) {
    const [donor, campaign, project] = await this.execute(context, (db) => Promise.all([input.donorId ? db.donor.findFirst({ where: { id: input.donorId, organizationId: context.organizationId } }) : Promise.resolve(null), input.campaignId ? db.donationCampaign.findFirst({ where: { id: input.campaignId, organizationId: context.organizationId } }) : Promise.resolve(null), input.projectId ? db.project.findFirst({ where: { id: input.projectId, organizationId: context.organizationId } }) : Promise.resolve(null)]));
    if (input.donorId && !donor) { await this.auditDenied(context, "TENANT_DONATION_DONOR_DENIED", "Donor", input.donorId); throw new FinancialScopeError("FORBIDDEN_RELATION", "المانح غير متاح ضمن المنظمة النشطة."); }
    if (input.campaignId && !campaign) { await this.auditDenied(context, "TENANT_DONATION_CAMPAIGN_DENIED", "DonationCampaign", input.campaignId); throw new FinancialScopeError("FORBIDDEN_RELATION", "الحملة غير متاحة ضمن المنظمة النشطة."); }
    if (input.projectId && !project) { await this.auditDenied(context, "TENANT_DONATION_PROJECT_DENIED", "Project", input.projectId); throw new FinancialScopeError("FORBIDDEN_RELATION", "المشروع غير متاح ضمن المنظمة النشطة."); }
    return this.execute(context, (db) => db.$transaction(async (tx) => {
      const donation = await tx.donation.create({ data: { organizationId: context.organizationId, amount: input.amount, paymentMethod: input.paymentMethod, paymentRef: input.paymentRef, status: "COMPLETED", isAnonymous: input.isAnonymous ?? false, isGuest: input.isGuest ?? false, guestName: input.guestName, guestPhone: input.guestPhone, guestEmail: input.guestEmail, donorId: donor?.id, campaignId: campaign?.id, projectId: project?.id } });
      const invoice = await tx.invoice.create({ data: { invoiceNo: input.invoiceNo, donationId: donation.id, amount: input.amount, taxAmount: 0, totalAmount: input.amount, taxNumber: input.taxNumber, buyerName: input.guestName || donor?.name, buyerPhone: input.guestPhone || donor?.phone, buyerEmail: input.guestEmail || donor?.email, status: "PAID" } });
      if (project) { const newCollected = project.collectedAmount + input.amount; const completion = project.targetAmount > 0 ? Math.min(100, Math.round((newCollected / project.targetAmount) * 100)) : 0; await tx.project.update({ where: { id: project.id }, data: { collectedAmount: newCollected, completionPercent: completion } }); }
      if (campaign) await tx.donationCampaign.update({ where: { id: campaign.id }, data: { collectedAmount: { increment: input.amount } } });
      if (donor) await tx.donor.update({ where: { id: donor.id }, data: { totalDonations: { increment: input.amount }, lastDonationAt: new Date() } });
      return { donation, invoice };
    }));
  }
}

export const financialRepository = new FinancialRepository();
