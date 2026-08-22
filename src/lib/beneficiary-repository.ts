import type { BeneficiaryStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { TenantContext } from "@/lib/tenant-context";

type BeneficiaryInput = Omit<Prisma.BeneficiaryUncheckedCreateInput, "id" | "organizationId" | "createdAt" | "updatedAt">;
type BeneficiaryUpdate = Omit<Prisma.BeneficiaryUncheckedUpdateInput, "organizationId" | "id" | "createdAt" | "updatedAt">;

export class BeneficiaryRepository {
  async list(context: TenantContext, input: { skip: number; take: number; search?: string; status?: string }) {
    const where: Prisma.BeneficiaryWhereInput = {
      organizationId: context.organizationId,
      ...(input.status ? { status: input.status as BeneficiaryStatus } : {}),
      ...(input.search ? { OR: ["name", "phone", "email", "nationalId"].map((field) => ({ [field]: { contains: input.search, mode: "insensitive" } })) } : {}),
    };
    const [data, total] = await prisma.$transaction([
      prisma.beneficiary.findMany({ where, skip: input.skip, take: input.take, orderBy: { createdAt: "desc" }, include: { documents: true } }),
      prisma.beneficiary.count({ where }),
    ]);
    return { data, total };
  }

  getById(context: TenantContext, id: string) {
    return prisma.beneficiary.findFirst({ where: { id, organizationId: context.organizationId }, include: { documents: true } });
  }

  create(context: TenantContext, input: BeneficiaryInput) {
    return prisma.beneficiary.create({ data: { ...input, organizationId: context.organizationId } });
  }

  async update(context: TenantContext, id: string, input: BeneficiaryUpdate) {
    const record = await prisma.beneficiary.findFirst({ where: { id, organizationId: context.organizationId }, select: { id: true } });
    if (!record) return null;
    return prisma.beneficiary.update({ where: { id: record.id }, data: input });
  }

  async deleteOrArchive(context: TenantContext, id: string) {
    const result = await prisma.beneficiary.deleteMany({ where: { id, organizationId: context.organizationId } });
    return result.count === 1;
  }

  async listDocuments(context: TenantContext, beneficiaryId: string) {
    const beneficiary = await prisma.beneficiary.findFirst({ where: { id: beneficiaryId, organizationId: context.organizationId }, select: { documents: true } });
    return beneficiary?.documents ?? null;
  }
}

export const beneficiaryRepository = new BeneficiaryRepository();
