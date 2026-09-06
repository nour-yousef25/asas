/**
 * إدارة الأنشطة التطوعية.
 */
import { Prisma, PrismaClient } from "@prisma/client";

export type VolunteerActivityCreateInput = Prisma.VolunteerActivityUncheckedCreateInput;

/**
 * إضافة نشاط جديد لمتطوع معين.
 */
export async function createActivity(db: PrismaClient, data: VolunteerActivityCreateInput) {
  return db.volunteerActivity.create({
    data,
  });
}

/**
 * جلب جميع الأنشطة المرتبطة بمتطوع معين.
 */
export async function getVolunteerActivities(db: PrismaClient, volunteerId: string) {
  return db.volunteerActivity.findMany({
    where: { volunteerId },
  });
}

/**
 * تحديث نشاط تطوعي معين.
 */
export async function updateActivity(db: PrismaClient, id: string, data: Prisma.VolunteerActivityUncheckedUpdateInput) {
  return db.volunteerActivity.update({
    where: { id },
    data,
  });
}

/**
 * حذف نشاط تطوعي معين.
 */
export async function deleteActivity(db: PrismaClient, id: string) {
  return db.volunteerActivity.delete({
    where: { id },
  });
}
