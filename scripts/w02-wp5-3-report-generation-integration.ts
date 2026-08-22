import { PermissionEffect } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PolicyAuthorizationError } from "@/lib/policy";
import type { TenantContext } from "@/lib/tenant-context";
import {
  parseReportGenerationInput,
  reportGenerationService,
  ReportScopeError,
  ReportValidationError,
} from "@/modules/reports/report-service";

type Check = { name: string; status: "PASS" | "FAIL"; detail: string };
const checks: Check[] = [];
const record = (name: string, ok: boolean, detail: string) => checks.push({ name, status: ok ? "PASS" : "FAIL", detail });

async function expectError<T extends Error>(name: string, work: () => Promise<unknown>, ErrorType: new (...args: never[]) => T) {
  try {
    await work();
    record(name, false, "unexpected success");
  } catch (error) {
    record(name, error instanceof ErrorType, error instanceof Error ? error.name : "non-error");
  }
}

async function main() {
  const suffix = Date.now().toString(36);
  const permission = await prisma.permission.findUnique({ where: { name: "report.generate" } });
  if (!permission) throw new Error("report.generate seed permission is missing");

  const orgA = await prisma.organization.create({ data: { name: `W02 Report A ${suffix}` } });
  const orgB = await prisma.organization.create({ data: { name: `W02 Report B ${suffix}` } });
  const userA = await prisma.user.create({ data: { name: `Report User A ${suffix}`, email: `report-a-${suffix}@audit.local` } });
  const userB = await prisma.user.create({ data: { name: `Report User B ${suffix}`, email: `report-b-${suffix}@audit.local` } });

  try {
    const [membershipA, membershipB] = await Promise.all([
      prisma.organizationMembership.create({ data: { organizationId: orgA.id, userId: userA.id, isDefault: true, role: "ADMIN" } }),
      prisma.organizationMembership.create({ data: { organizationId: orgB.id, userId: userB.id, isDefault: true, role: "ADMIN" } }),
    ]);
    const [roleA, roleB] = await Promise.all([
      prisma.organizationRole.create({ data: { organizationId: orgA.id, name: `REPORT_A_${suffix}`, isSystem: false } }),
      prisma.organizationRole.create({ data: { organizationId: orgB.id, name: `REPORT_B_${suffix}`, isSystem: false } }),
    ]);
    await prisma.$transaction([
      prisma.organizationRolePermission.create({ data: { organizationRoleId: roleA.id, permissionId: permission.id, effect: PermissionEffect.ALLOW } }),
      prisma.organizationRolePermission.create({ data: { organizationRoleId: roleB.id, permissionId: permission.id, effect: PermissionEffect.ALLOW } }),
      prisma.membershipRole.create({ data: { membershipId: membershipA.id, organizationRoleId: roleA.id } }),
      prisma.membershipRole.create({ data: { membershipId: membershipB.id, organizationRoleId: roleB.id } }),
      prisma.user.update({ where: { id: userA.id }, data: { activeOrganizationId: orgA.id } }),
      prisma.user.update({ where: { id: userB.id }, data: { activeOrganizationId: orgB.id } }),
    ]);

    const contextA: TenantContext = { organizationId: orgA.id, membershipId: membershipA.id, userId: userA.id, policySnapshotVersion: membershipA.policyVersion, correlationId: `report-a-${suffix}` };
    const contextB: TenantContext = { organizationId: orgB.id, membershipId: membershipB.id, userId: userB.id, policySnapshotVersion: membershipB.policyVersion, correlationId: `report-b-${suffix}` };

    const budgetA = await prisma.budget.create({ data: { organizationId: orgA.id, title: `A Budget ${suffix}`, fiscalYear: "2026", totalAmount: 1000 } });
    const budgetB = await prisma.budget.create({ data: { organizationId: orgB.id, title: `B Budget ${suffix}`, fiscalYear: "2026", totalAmount: 2000 } });
    const [itemA, itemB] = await Promise.all([
      prisma.budgetItem.create({ data: { organizationId: orgA.id, budgetId: budgetA.id, category: "Operations", allocated: 1000 } }),
      prisma.budgetItem.create({ data: { organizationId: orgB.id, budgetId: budgetB.id, category: "Operations", allocated: 2000 } }),
    ]);
    await Promise.all([
      prisma.expense.create({ data: { organizationId: orgA.id, budgetItemId: itemA.id, title: `A Expense ${suffix}`, amount: 160, category: "Utilities", expenseDate: new Date("2026-03-10T00:00:00.000Z") } }),
      prisma.expense.create({ data: { organizationId: orgB.id, budgetItemId: itemB.id, title: `B Expense ${suffix}`, amount: 390, category: "Utilities", expenseDate: new Date("2026-03-10T00:00:00.000Z") } }),
    ]);

    const [donorA, donorB] = await Promise.all([
      prisma.donor.create({ data: { organizationId: orgA.id, name: `A Donor ${suffix}` } }),
      prisma.donor.create({ data: { organizationId: orgB.id, name: `B Donor ${suffix}` } }),
    ]);
    const [campaignA, campaignB, projectA, projectB] = await Promise.all([
      prisma.donationCampaign.create({ data: { organizationId: orgA.id, title: `A Campaign ${suffix}`, targetAmount: 1000, startDate: new Date("2026-01-01T00:00:00.000Z") } }),
      prisma.donationCampaign.create({ data: { organizationId: orgB.id, title: `B Campaign ${suffix}`, targetAmount: 2000, startDate: new Date("2026-01-01T00:00:00.000Z") } }),
      prisma.project.create({ data: { organizationId: orgA.id, title: `A Project ${suffix}`, targetAmount: 1000, startDate: new Date("2026-01-01T00:00:00.000Z") } }),
      prisma.project.create({ data: { organizationId: orgB.id, title: `B Project ${suffix}`, targetAmount: 2000, startDate: new Date("2026-01-01T00:00:00.000Z") } }),
    ]);
    const [donationA1, donationA2, donationB] = await Promise.all([
      prisma.donation.create({ data: { organizationId: orgA.id, donorId: donorA.id, campaignId: campaignA.id, projectId: projectA.id, amount: 125, status: "COMPLETED", paymentMethod: "CARD", createdAt: new Date("2026-03-01T00:00:00.000Z") } }),
      prisma.donation.create({ data: { organizationId: orgA.id, amount: 75, isGuest: true, guestName: `A Guest ${suffix}`, status: "COMPLETED", paymentMethod: "CASH", createdAt: new Date("2026-03-02T00:00:00.000Z") } }),
      prisma.donation.create({ data: { organizationId: orgB.id, donorId: donorB.id, campaignId: campaignB.id, projectId: projectB.id, amount: 880, status: "COMPLETED", paymentMethod: "CARD", createdAt: new Date("2026-03-01T00:00:00.000Z") } }),
    ]);

    const defaultFinancial = parseReportGenerationInput("financial", new URLSearchParams());
    const defaultDonations = parseReportGenerationInput("donations", new URLSearchParams());
    const [financialA, financialB, donationsA, donationsB] = await Promise.all([
      reportGenerationService.generateFinancial(contextA, defaultFinancial),
      reportGenerationService.generateFinancial(contextB, defaultFinancial),
      reportGenerationService.generateDonations(contextA, defaultDonations),
      reportGenerationService.generateDonations(contextB, defaultDonations),
    ]);
    record("FINANCIAL_A_SEES_A_ONLY", financialA.summary.totalBudgetAmount === 1000 && financialA.summary.totalExpenses === 160 && financialA.rows.every((row) => row.id === budgetA.id), JSON.stringify(financialA.summary));
    record("FINANCIAL_B_SEES_B_ONLY", financialB.summary.totalBudgetAmount === 2000 && financialB.summary.totalExpenses === 390 && financialB.rows.every((row) => row.id === budgetB.id), JSON.stringify(financialB.summary));
    record("DONATIONS_A_SEES_A_ONLY", donationsA.summary.donationCount === 2 && donationsA.summary.totalAmount === 200 && donationsA.rows.every((row) => row.id !== donationB.id), JSON.stringify(donationsA.summary));
    record("DONATIONS_B_SEES_B_ONLY", donationsB.summary.donationCount === 1 && donationsB.summary.totalAmount === 880 && donationsB.rows.every((row) => row.id === donationB.id), JSON.stringify(donationsB.summary));

    const spoofedInput = parseReportGenerationInput("financial", new URLSearchParams(`organizationId=${orgB.id}`));
    const spoofedResult = await reportGenerationService.generateFinancial(contextA, spoofedInput);
    record("CLIENT_ORGANIZATION_ID_IGNORED", spoofedResult.summary.totalBudgetAmount === 1000 && spoofedResult.rows.every((row) => row.id === budgetA.id), "organizationId is not a parsed authority parameter");

    const filteredFinancial = await reportGenerationService.generateFinancial(contextA, parseReportGenerationInput("financial", new URLSearchParams(`budgetId=${budgetA.id}&category=Operations&expenseCategory=Utilities&from=2026-03-01&to=2026-03-31`)));
    record("FINANCIAL_FILTERS_SCOPED", filteredFinancial.summary.totalExpenses === 160 && filteredFinancial.rows.length === 1, JSON.stringify(filteredFinancial.summary));
    const pagedDonations = await reportGenerationService.generateDonations(contextA, parseReportGenerationInput("donations", new URLSearchParams(`page=2&pageSize=1&sort=amount&direction=asc`)));
    const searchedDonations = await reportGenerationService.generateDonations(contextA, parseReportGenerationInput("donations", new URLSearchParams(`search=${encodeURIComponent(`A Donor ${suffix}`)}`)));
    record("PAGINATION_SCOPED", pagedDonations.pagination.total === 2 && pagedDonations.rows.length === 1 && pagedDonations.rows[0]?.id !== donationB.id, JSON.stringify(pagedDonations.pagination));
    record("SEARCH_SCOPED", searchedDonations.summary.donationCount === 1 && searchedDonations.rows[0]?.id === donationA1.id, JSON.stringify(searchedDonations.summary));

    await expectError("FOREIGN_BUDGET_DENIED", () => reportGenerationService.generateFinancial(contextA, parseReportGenerationInput("financial", new URLSearchParams(`budgetId=${budgetB.id}`))), ReportScopeError);
    await expectError("FOREIGN_DONATION_DENIED", () => reportGenerationService.generateDonations(contextA, parseReportGenerationInput("donations", new URLSearchParams(`recordId=${donationB.id}`))), ReportScopeError);
    await expectError("FOREIGN_DONOR_DENIED", () => reportGenerationService.generateDonations(contextA, parseReportGenerationInput("donations", new URLSearchParams(`donorId=${donorB.id}`))), ReportScopeError);
    await expectError("FOREIGN_CAMPAIGN_DENIED", () => reportGenerationService.generateDonations(contextA, parseReportGenerationInput("donations", new URLSearchParams(`campaignId=${campaignB.id}`))), ReportScopeError);
    await expectError("FOREIGN_PROJECT_DENIED", () => reportGenerationService.generateDonations(contextA, parseReportGenerationInput("donations", new URLSearchParams(`projectId=${projectB.id}`))), ReportScopeError);
    await expectError("MALFORMED_DATE_REJECTED", async () => parseReportGenerationInput("financial", new URLSearchParams("from=invalid")), ReportValidationError);
    await expectError("MALFORMED_PAGINATION_REJECTED", async () => parseReportGenerationInput("donations", new URLSearchParams("page=-1")), ReportValidationError);

    await prisma.membershipPermissionOverride.create({ data: { membershipId: membershipA.id, permissionId: permission.id, effect: PermissionEffect.DENY, reason: "audit negative policy test" } });
    await expectError("EXPLICIT_DENY_ENFORCED", () => reportGenerationService.generateFinancial(contextA, defaultFinancial), PolicyAuthorizationError);
    await prisma.membershipPermissionOverride.delete({ where: { membershipId_permissionId: { membershipId: membershipA.id, permissionId: permission.id } } });
    await prisma.organizationMembership.update({ where: { id: membershipA.id }, data: { policyVersion: { increment: 1 } } });
    await expectError("STALE_POLICY_ENFORCED", () => reportGenerationService.generateFinancial(contextA, defaultFinancial), PolicyAuthorizationError);

    const auditRows = await prisma.auditLog.findMany({ where: { organizationId: orgA.id, entity: "ReportGeneration" }, select: { action: true, details: true } });
    const serializedAudit = JSON.stringify(auditRows);
    record("AUDIT_REDACTED_AND_SCOPED", auditRows.some((row) => row.action === "REPORT_GENERATION_ALLOWED") && auditRows.some((row) => row.action === "REPORT_GENERATION_DENIED") && !serializedAudit.includes(`B Donor ${suffix}`) && !serializedAudit.includes(`A Donor ${suffix}`), `auditRows=${auditRows.length}`);
  } finally {
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.donation.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.expense.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.budgetItem.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.budget.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.donor.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.donationCampaign.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.project.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  }
  const status = checks.every((check) => check.status === "PASS") ? "PASS" : "FAIL";
  console.log(JSON.stringify({ runId: `W02-WP5-3-REPORT-GENERATION-${new Date().toISOString()}`, status, checks }));
  await prisma.$disconnect();
  process.exit(status === "PASS" ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
