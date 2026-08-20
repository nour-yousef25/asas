/**
 * إدارة الأنشطة التطوعية.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type VolunteerActivityCreateInput = {
  volunteerId: string;
  description: string;
  hours: number;
  date: Date;
};

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
export async function updateActivity(id: string, data: Partial<VolunteerActivityCreateInput>) {
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