/**
 * وظائف إدارة الفعاليات.
 */
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type EventCreateInput = Prisma.EventUncheckedCreateInput;

/**
 * إنشاء فعالية جديدة.
 */
export async function createEvent(data: EventCreateInput) {
  return prisma.event.create({
    data,
  });
}

/**
 * جلب جميع الفعاليات.
 */
export async function getAllEvents() {
  return prisma.event.findMany();
}

/**
 * جلب فعالية عبر معرفها.
 */
export async function getEventById(id: string) {
  return prisma.event.findUnique({
    where: { id },
  });
}

/**
 * تحديث بيانات فعالية موجودة.
 */
export async function updateEvent(id: string, data: Prisma.EventUncheckedUpdateInput) {
  return prisma.event.update({
    where: { id },
    data,
  });
}

/**
 * حذف فعالية عبر معرفها.
 */
export async function deleteEvent(id: string) {
  return prisma.event.delete({
    where: { id },
  });
}
