import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { financialRepository, FinancialScopeError } from "@/lib/financial-repository";
import { resolveTenantContextForUser } from "@/lib/tenant-context";

type Check = { name: string; status: "PASS" | "FAIL"; detail: string };
const checks: Check[] = [];
const record = (name: string, ok: boolean, detail: string) => checks.push({ name, status: ok ? "PASS" : "FAIL", detail });

async function expectScopeError(name: string, work: () => Promise<unknown>) {
  try {
    await work();
    record(name, false, "Expected FORBIDDEN_RELATION but action succeeded.");
  } catch (error) {
    record(name, error instanceof FinancialScopeError && error.code === "FORBIDDEN_RELATION", `actual=${error instanceof FinancialScopeError ? error.code : "UNKNOWN"}`);
  }
}

async function main() {
  const suffix = Date.now().toString(36);
  const orgA = await prisma.organization.create({ data: { name: `WP5-2B Org A ${suffix}` } });
  const orgB = await prisma.organization.create({ data: { name: `WP5-2B Org B ${suffix}` } });
  const userA = await prisma.user.create({ data: { name: `WP5-2B User A ${suffix}`, email: `wp5-2b-a-${suffix}@audit.invalid`, role: Role.MEMBER, activeOrganizationId: orgA.id } });
  const userB = await prisma.user.create({ data: { name: `WP5-2B User B ${suffix}`, email: `wp5-2b-b-${suffix}@audit.invalid`, role: Role.MEMBER, activeOrganizationId: orgB.id } });
  await prisma.organizationMembership.createMany({ data: [{ organizationId: orgA.id, userId: userA.id, role: Role.MEMBER, isDefault: true }, { organizationId: orgB.id, userId: userB.id, role: Role.MEMBER, isDefault: true }] });
  const campaignDates = { startDate: new Date("2026-01-01T00:00:00.000Z"), endDate: new Date("2026-12-31T00:00:00.000Z") };
  try {
    const contextA = await resolveTenantContextForUser({ userId: userA.id, authVersion: 1 });
    const contextB = await resolveTenantContextForUser({ userId: userB.id, authVersion: 1 });
    const donorA = await financialRepository.createDonor(contextA, { name: `Donor A ${suffix}`, donorType: "INDIVIDUAL", status: "ACTIVE" });
    const donorB = await financialRepository.createDonor(contextB, { name: `Donor B ${suffix}`, donorType: "INDIVIDUAL", status: "ACTIVE" });
    const campaignA = await financialRepository.createCampaign(contextA, { title: `Campaign A ${suffix}`, targetAmount: 1000, ...campaignDates, status: "ACTIVE" });
    const campaignB = await financialRepository.createCampaign(contextB, { title: `Campaign B ${suffix}`, targetAmount: 1000, ...campaignDates, status: "ACTIVE" });
    const projectA = await prisma.project.create({ data: { organizationId: orgA.id, title: `Project A ${suffix}`, targetAmount: 5000, startDate: campaignDates.startDate } });
    const projectB = await prisma.project.create({ data: { organizationId: orgB.id, title: `Project B ${suffix}`, targetAmount: 5000, startDate: campaignDates.startDate } });
    const created = await financialRepository.createDonation(contextA, { amount: 250, paymentMethod: "mada", paymentRef: `PAY-${suffix}`, donorId: donorA.id, campaignId: campaignA.id, projectId: projectA.id, guestName: "Guest A", guestPhone: "0500000000", guestEmail: "guest-a@audit.invalid", invoiceNo: `INV-${suffix}`, taxNumber: "300000000000003" });
    record("DONATION_CREATED_IN_ORG_A", created.donation.organizationId === orgA.id && created.invoice.donationId === created.donation.id, `org=${created.donation.organizationId}`);
    const [donationsA, donationsB] = await Promise.all([
      financialRepository.listDonations(contextA, { skip: 0, take: 10, search: "Guest" }),
      financialRepository.listDonations(contextB, { skip: 0, take: 10, search: "Guest" }),
    ]);
    record("DONATION_SEARCH_ISOLATED", donationsA.total === 1 && donationsB.total === 0, `A=${donationsA.total};B=${donationsB.total}`);
    record("DONOR_IDOR_BLOCKED", (await financialRepository.getDonorById(contextA, donorB.id)) === null, "A get donor B returned null");
    record("DONOR_CHILD_WRITE_BLOCKED", (await financialRepository.addDonorCommunication(contextA, donorB.id, { type: "NOTE", notes: "x" })) === null, "A donor B communication returned null");
    await expectScopeError("DONATION_CROSS_TENANT_DONOR_BLOCKED", () => financialRepository.createDonation(contextA, { amount: 100, paymentMethod: "mada", paymentRef: `PAY2-${suffix}`, donorId: donorB.id, invoiceNo: `INV2-${suffix}`, taxNumber: "300000000000003" }));
    await expectScopeError("DONATION_CROSS_TENANT_CAMPAIGN_BLOCKED", () => financialRepository.createDonation(contextA, { amount: 100, paymentMethod: "mada", paymentRef: `PAY3-${suffix}`, campaignId: campaignB.id, invoiceNo: `INV3-${suffix}`, taxNumber: "300000000000003" }));
    await expectScopeError("DONATION_CROSS_TENANT_PROJECT_BLOCKED", () => financialRepository.createDonation(contextA, { amount: 100, paymentMethod: "mada", paymentRef: `PAY4-${suffix}`, projectId: projectB.id, invoiceNo: `INV4-${suffix}`, taxNumber: "300000000000003" }));
    const campaignsA = await financialRepository.listCampaigns(contextA, null);
    record("CAMPAIGN_LIST_ISOLATED", campaignsA.length === 1 && campaignsA[0]?.id === campaignA.id, `count=${campaignsA.length}`);
  } finally {
    await prisma.auditLog.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.invoice.deleteMany({ where: { invoiceNo: { startsWith: "INV-" } } });
    await prisma.donation.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.project.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.donorCommunication.deleteMany({ where: { donor: { organizationId: { in: [orgA.id, orgB.id] } } } });
    await prisma.donationCampaign.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.donor.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organizationMembership.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  }
  const status = checks.every((item) => item.status === "PASS") ? "PASS" : "FAIL";
  console.log(JSON.stringify({ runId: `W02-WP5-2B-${new Date().toISOString()}`, status, checks }));
  await prisma.$disconnect();
  process.exit(status === "PASS" ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
