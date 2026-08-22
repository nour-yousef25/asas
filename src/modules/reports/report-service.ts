import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission, PolicyAuthorizationError } from "@/lib/policy";
import type { TenantContext } from "@/lib/tenant-context";

export type ReportName = "financial" | "donations";
type SortDirection = "asc" | "desc";

export type ReportGenerationInput = Readonly<{
  page: number;
  pageSize: number;
  direction: SortDirection;
  sort: "createdAt" | "amount" | "title";
  from?: Date;
  to?: Date;
  search?: string;
  budgetId?: string;
  category?: string;
  expenseCategory?: string;
  donorId?: string;
  campaignId?: string;
  projectId?: string;
  recordId?: string;
}>;

export class ReportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportValidationError";
  }
}

export class ReportScopeError extends Error {
  constructor(public readonly entity: string, public readonly entityId: string) {
    super("المورد غير متاح ضمن المنظمة النشطة.");
    this.name = "ReportScopeError";
  }
}

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ReportValidationError("صيغة التاريخ غير صالحة.");
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(date.getTime())) throw new ReportValidationError("صيغة التاريخ غير صالحة.");
  return date;
}

function parsePositiveInteger(value: string | null, fallback: number, maximum: number, label: string) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) throw new ReportValidationError(`${label} غير صالح.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) throw new ReportValidationError(`${label} خارج النطاق.`);
  return parsed;
}

function optionalText(value: string | null, label: string) {
  if (value === null || value.trim() === "") return undefined;
  if (value.length > 200) throw new ReportValidationError(`${label} طويل جدًا.`);
  return value.trim();
}

export function parseReportGenerationInput(reportName: ReportName, searchParams: URLSearchParams): ReportGenerationInput {
  const from = parseDate(searchParams.get("from"));
  const to = parseDate(searchParams.get("to"), true);
  if (from && to && from > to) throw new ReportValidationError("نطاق التاريخ غير صالح.");

  const sort = searchParams.get("sort") ?? "createdAt";
  const allowedSorts = reportName === "financial" ? ["createdAt", "amount", "title"] : ["createdAt", "amount"];
  if (!allowedSorts.includes(sort)) throw new ReportValidationError("حقل الفرز غير صالح.");
  const direction = searchParams.get("direction") ?? "desc";
  if (direction !== "asc" && direction !== "desc") throw new ReportValidationError("اتجاه الفرز غير صالح.");

  return {
    page: parsePositiveInteger(searchParams.get("page"), 1, 1_000_000, "رقم الصفحة"),
    pageSize: parsePositiveInteger(searchParams.get("pageSize"), 25, 100, "حجم الصفحة"),
    sort: sort as ReportGenerationInput["sort"],
    direction,
    from,
    to,
    search: optionalText(searchParams.get("search"), "البحث"),
    budgetId: optionalText(searchParams.get("budgetId"), "معرف الميزانية"),
    category: optionalText(searchParams.get("category"), "الفئة"),
    expenseCategory: optionalText(searchParams.get("expenseCategory"), "فئة المصروف"),
    donorId: optionalText(searchParams.get("donorId"), "معرف المانح"),
    campaignId: optionalText(searchParams.get("campaignId"), "معرف الحملة"),
    projectId: optionalText(searchParams.get("projectId"), "معرف المشروع"),
    recordId: optionalText(searchParams.get("recordId"), "معرف السجل"),
  };
}

function hasFilter(input: ReportGenerationInput) {
  return {
    dateRange: Boolean(input.from || input.to),
    search: Boolean(input.search),
    budget: Boolean(input.budgetId),
    category: Boolean(input.category),
    expenseCategory: Boolean(input.expenseCategory),
    donor: Boolean(input.donorId),
    campaign: Boolean(input.campaignId),
    project: Boolean(input.projectId),
    record: Boolean(input.recordId),
    pagination: input.page !== 1 || input.pageSize !== 25,
    sort: input.sort,
    direction: input.direction,
  };
}

export class ReportGenerationService {
  private async audit(
    context: TenantContext,
    action: "REPORT_GENERATION_ALLOWED" | "REPORT_GENERATION_DENIED",
    reportType: ReportName,
    input: ReportGenerationInput,
    reasonCode: string,
  ) {
    await prisma.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action,
        entity: "ReportGeneration",
        entityId: reportType,
        details: {
          actorMembershipId: context.membershipId,
          decision: action === "REPORT_GENERATION_ALLOWED" ? "ALLOW" : "DENY",
          reasonCode,
          correlationId: context.correlationId,
          source: "report-generation-service",
          reportType,
          purposeCode: null,
          purposeStatus: "NOT_CONFIGURED",
          filterPresence: hasFilter(input),
        },
      },
    });
  }

  private async assertScopedResource(context: TenantContext, entity: "Budget" | "Donation" | "Donor" | "DonationCampaign" | "Project", id: string) {
    const exists = await {
      Budget: () => prisma.budget.findFirst({ where: { id, organizationId: context.organizationId }, select: { id: true } }),
      Donation: () => prisma.donation.findFirst({ where: { id, organizationId: context.organizationId }, select: { id: true } }),
      Donor: () => prisma.donor.findFirst({ where: { id, organizationId: context.organizationId }, select: { id: true } }),
      DonationCampaign: () => prisma.donationCampaign.findFirst({ where: { id, organizationId: context.organizationId }, select: { id: true } }),
      Project: () => prisma.project.findFirst({ where: { id, organizationId: context.organizationId }, select: { id: true } }),
    }[entity]();
    if (exists) return;
    await prisma.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "REPORT_GENERATION_RESOURCE_DENIED",
        entity,
        entityId: id,
        details: {
          actorMembershipId: context.membershipId,
          decision: "DENY",
          reasonCode: "TENANT_SCOPE",
          correlationId: context.correlationId,
          source: "report-generation-service",
        },
      },
    });
    throw new ReportScopeError(entity, id);
  }

  private async authorize(context: TenantContext, reportType: ReportName, input: ReportGenerationInput) {
    try {
      await requirePermission(context, "report.generate");
    } catch (error) {
      if (error instanceof PolicyAuthorizationError) {
        await this.audit(context, "REPORT_GENERATION_DENIED", reportType, input, error.decision.reason);
      }
      throw error;
    }
  }

  async generateFinancial(context: TenantContext, input: ReportGenerationInput) {
    await this.authorize(context, "financial", input);
    if (input.budgetId) await this.assertScopedResource(context, "Budget", input.budgetId);

    const itemWhere: Prisma.BudgetItemWhereInput = { organizationId: context.organizationId };
    if (input.category) itemWhere.category = { contains: input.category, mode: "insensitive" };
    if (input.expenseCategory) {
      itemWhere.expenses = { some: { organizationId: context.organizationId, category: { contains: input.expenseCategory, mode: "insensitive" } } };
    }

    const budgetWhere: Prisma.BudgetWhereInput = {
      organizationId: context.organizationId,
      ...(input.budgetId ? { id: input.budgetId } : {}),
      ...(input.search ? { title: { contains: input.search, mode: "insensitive" } } : {}),
      ...(input.category || input.expenseCategory ? { items: { some: itemWhere } } : {}),
    };
    const expenseWhere: Prisma.ExpenseWhereInput = {
      organizationId: context.organizationId,
      ...(input.from || input.to ? { expenseDate: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lte: input.to } : {}) } } : {}),
      ...(input.expenseCategory ? { category: { contains: input.expenseCategory, mode: "insensitive" } } : {}),
    };
    const orderBy: Prisma.BudgetOrderByWithRelationInput = input.sort === "title"
      ? { title: input.direction }
      : input.sort === "amount"
        ? { totalAmount: input.direction }
        : { createdAt: input.direction };

    const [budgets, totalBudgets, budgetAggregate, expenseAggregate] = await prisma.$transaction([
      prisma.budget.findMany({
        where: budgetWhere,
        orderBy,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        select: {
          id: true,
          title: true,
          fiscalYear: true,
          totalAmount: true,
          spentAmount: true,
          items: {
            where: itemWhere,
            orderBy: { category: "asc" },
            select: {
              id: true,
              category: true,
              allocated: true,
              spent: true,
              expenses: { where: expenseWhere, select: { id: true, title: true, amount: true, category: true, expenseDate: true, status: true } },
            },
          },
        },
      }),
      prisma.budget.count({ where: budgetWhere }),
      prisma.budget.aggregate({ where: budgetWhere, _sum: { totalAmount: true } }),
      prisma.expense.aggregate({
        where: {
          ...expenseWhere,
          budgetItem: { is: { organizationId: context.organizationId, budget: { is: budgetWhere } } },
        },
        _sum: { amount: true },
      }),
    ]);

    const totalBudgetAmount = budgetAggregate._sum.totalAmount ?? 0;
    const totalExpenses = expenseAggregate._sum.amount ?? 0;
    const result = {
      reportType: "financial" as const,
      summary: { budgetCount: totalBudgets, totalBudgetAmount, totalExpenses, remainingAmount: totalBudgetAmount - totalExpenses },
      pagination: { page: input.page, pageSize: input.pageSize, total: totalBudgets, totalPages: Math.ceil(totalBudgets / input.pageSize) },
      rows: budgets.map((budget) => ({
        ...budget,
        periodExpenses: budget.items.reduce((sum, item) => sum + item.expenses.reduce((itemSum, expense) => itemSum + expense.amount, 0), 0),
      })),
    };
    await this.audit(context, "REPORT_GENERATION_ALLOWED", "financial", input, "ALLOW");
    return result;
  }

  async generateDonations(context: TenantContext, input: ReportGenerationInput) {
    await this.authorize(context, "donations", input);
    await Promise.all([
      input.recordId ? this.assertScopedResource(context, "Donation", input.recordId) : Promise.resolve(),
      input.donorId ? this.assertScopedResource(context, "Donor", input.donorId) : Promise.resolve(),
      input.campaignId ? this.assertScopedResource(context, "DonationCampaign", input.campaignId) : Promise.resolve(),
      input.projectId ? this.assertScopedResource(context, "Project", input.projectId) : Promise.resolve(),
    ]);

    const donationWhere: Prisma.DonationWhereInput = {
      organizationId: context.organizationId,
      ...(input.recordId ? { id: input.recordId } : {}),
      ...(input.donorId ? { donorId: input.donorId } : {}),
      ...(input.campaignId ? { campaignId: input.campaignId } : {}),
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.from || input.to ? { createdAt: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lte: input.to } : {}) } } : {}),
      ...(input.search ? {
        OR: [
          { guestName: { contains: input.search, mode: "insensitive" } },
          { paymentMethod: { contains: input.search, mode: "insensitive" } },
          { donor: { is: { organizationId: context.organizationId, name: { contains: input.search, mode: "insensitive" } } } },
        ],
      } : {}),
    };
    const orderBy: Prisma.DonationOrderByWithRelationInput = input.sort === "amount" ? { amount: input.direction } : { createdAt: input.direction };
    const [donations, aggregate] = await prisma.$transaction([
      prisma.donation.findMany({
        where: donationWhere,
        orderBy,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        select: { id: true, donorId: true, campaignId: true, projectId: true, amount: true, currency: true, status: true, isAnonymous: true, isGuest: true, guestName: true, paymentMethod: true, createdAt: true },
      }),
      prisma.donation.aggregate({ where: donationWhere, _sum: { amount: true }, _count: { _all: true } }),
    ]);
    const donorIds = [...new Set(donations.flatMap((donation) => donation.donorId ? [donation.donorId] : []))];
    const campaignIds = [...new Set(donations.flatMap((donation) => donation.campaignId ? [donation.campaignId] : []))];
    const projectIds = [...new Set(donations.flatMap((donation) => donation.projectId ? [donation.projectId] : []))];
    const [donors, campaigns, projects] = await prisma.$transaction([
      prisma.donor.findMany({ where: { organizationId: context.organizationId, id: { in: donorIds } }, select: { id: true, name: true } }),
      prisma.donationCampaign.findMany({ where: { organizationId: context.organizationId, id: { in: campaignIds } }, select: { id: true, title: true } }),
      prisma.project.findMany({ where: { organizationId: context.organizationId, id: { in: projectIds } }, select: { id: true, title: true } }),
    ]);
    const donorById = new Map(donors.map((donor) => [donor.id, donor.name]));
    const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign.title]));
    const projectById = new Map(projects.map((project) => [project.id, project.title]));
    const total = aggregate._count._all;
    const result = {
      reportType: "donations" as const,
      summary: { donationCount: total, totalAmount: aggregate._sum.amount ?? 0 },
      pagination: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.ceil(total / input.pageSize) },
      rows: donations.map((donation) => ({
        ...donation,
        donorName: donation.isAnonymous ? "متبرع مجهول" : donation.donorId ? donorById.get(donation.donorId) ?? "غير متاح" : donation.guestName ?? "متبرع مجهول",
        campaignTitle: donation.campaignId ? campaignById.get(donation.campaignId) ?? null : null,
        projectTitle: donation.projectId ? projectById.get(donation.projectId) ?? null : null,
      })),
    };
    await this.audit(context, "REPORT_GENERATION_ALLOWED", "donations", input, "ALLOW");
    return result;
  }
}

export const reportGenerationService = new ReportGenerationService();
