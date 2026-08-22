import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { beneficiaryRepository } from "@/lib/beneficiary-repository";
import { resolveTenantContextForUser } from "@/lib/tenant-context";

type Check = { name: string; status: "PASS" | "FAIL"; detail: string };
const checks: Check[] = [];
const record = (name: string, ok: boolean, detail: string) => checks.push({ name, status: ok ? "PASS" : "FAIL", detail });

async function main() {
  const suffix = Date.now().toString(36);
  const orgA = await prisma.organization.create({ data: { name: `WP5-2A Org A ${suffix}` } });
  const orgB = await prisma.organization.create({ data: { name: `WP5-2A Org B ${suffix}` } });
  const userA = await prisma.user.create({ data: { name: `WP5-2A User A ${suffix}`, email: `wp5-2a-a-${suffix}@audit.invalid`, role: Role.MEMBER, activeOrganizationId: orgA.id } });
  const userB = await prisma.user.create({ data: { name: `WP5-2A User B ${suffix}`, email: `wp5-2a-b-${suffix}@audit.invalid`, role: Role.MEMBER, activeOrganizationId: orgB.id } });
  await prisma.organizationMembership.createMany({ data: [{ organizationId: orgA.id, userId: userA.id, role: Role.MEMBER, isDefault: true }, { organizationId: orgB.id, userId: userB.id, role: Role.MEMBER, isDefault: true }] });
  try {
    const contextA = await resolveTenantContextForUser({ userId: userA.id, authVersion: 1 });
    const contextB = await resolveTenantContextForUser({ userId: userB.id, authVersion: 1 });
    const beneficiaryA = await beneficiaryRepository.create(contextA, { name: `A Search ${suffix}`, phone: `51${suffix.slice(-8)}`, organizationId: orgB.id } as never);
    const beneficiaryB = await beneficiaryRepository.create(contextB, { name: `B Search ${suffix}`, phone: `52${suffix.slice(-8)}` });
    record("CLIENT_TENANT_SPOOF_IGNORED", beneficiaryA.organizationId === orgA.id, `owner=${beneficiaryA.organizationId};expected=${orgA.id}`);
    const [listA, listB] = await Promise.all([beneficiaryRepository.list(contextA, { skip: 0, take: 10, search: "Search" }), beneficiaryRepository.list(contextB, { skip: 0, take: 10, search: "Search" })]);
    record("SEARCH_PAGINATION_ISOLATED", listA.total === 1 && listA.data[0]?.id === beneficiaryA.id && listB.total === 1 && listB.data[0]?.id === beneficiaryB.id, `A=${listA.total};B=${listB.total}`);
    record("CROSS_TENANT_GET_IDOR_BLOCKED", (await beneficiaryRepository.getById(contextA, beneficiaryB.id)) === null, "A get B returned null");
    record("CROSS_TENANT_UPDATE_BLOCKED", (await beneficiaryRepository.update(contextA, beneficiaryB.id, { notes: "forbidden" })) === null, "A update B returned null");
    record("CROSS_TENANT_DELETE_BLOCKED", !(await beneficiaryRepository.deleteOrArchive(contextA, beneficiaryB.id)), "A delete B returned false");
    await prisma.beneficiaryDocument.createMany({ data: [{ beneficiaryId: beneficiaryA.id, name: "A", fileType: "text/plain", fileUrl: "audit://a" }, { beneficiaryId: beneficiaryB.id, name: "B", fileType: "text/plain", fileUrl: "audit://b" }] });
    const [docsA, docsB] = await Promise.all([beneficiaryRepository.listDocuments(contextA, beneficiaryA.id), beneficiaryRepository.listDocuments(contextA, beneficiaryB.id)]);
    record("NESTED_DOCUMENT_OWNERSHIP_BLOCKED", docsA?.length === 1 && docsB === null, `A=${docsA?.length};B=${docsB}`);
  } finally {
    await prisma.beneficiary.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organizationMembership.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  }
  const status = checks.every((item) => item.status === "PASS") ? "PASS" : "FAIL";
  console.log(JSON.stringify({ runId: `W02-WP5-2A-${new Date().toISOString()}`, status, checks }));
  await prisma.$disconnect(); process.exit(status === "PASS" ? 0 : 1);
}
main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
