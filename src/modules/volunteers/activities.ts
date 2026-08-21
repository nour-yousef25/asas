/**
 * إدارة الأنشطة التطوعية.
 */
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type VolunteerActivityCreateInput = Prisma.VolunteerActivityUncheckedCreateInput;

/**
 * إضافة نشاط جديد لمتطوع معين.
 */
export async function createActivity(data: VolunteerActivityCreateInput) {
  return prisma.volunteerActivity.create({
    data,
  });
}

/**
 * جلب جميع الأنشطة المرتبطة بمتطوع معين.
 */
export async function getVolunteerActivities(volunteerId: string) {
  return prisma.volunteerActivity.findMany({
    where: { volunteerId },
  });
}

/**
 * تحديث نشاط تطوعي معين.
 */
export async function updateActivity(id: string, data: Prisma.VolunteerActivityUncheckedUpdateInput) {
  return prisma.volunteerActivity.update({
    where: { id },
    data,
  });
}

/**
 * حذف نشاط تطوعي معين.
 */
export async function deleteActivity(id: string) {
  return prisma.volunteerActivity.delete({
    where: { id },
  });
}
