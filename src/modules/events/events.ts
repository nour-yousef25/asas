/**
 * وظائف إدارة الفعاليات.
 */
import { Prisma, PrismaClient } from "@prisma/client";

export type EventCreateInput = Prisma.EventUncheckedCreateInput;

/**
 * إنشاء فعالية جديدة.
 */
export async function createEvent(db: PrismaClient, data: EventCreateInput) {
  return db.event.create({
    data,
  });
}

/**
 * جلب جميع الفعاليات.
 */
export async function getAllEvents(db: PrismaClient) {
  return db.event.findMany();
}

/**
 * جلب فعالية عبر معرفها.
 */
export async function getEventById(db: PrismaClient, id: string) {
  return db.event.findUnique({
    where: { id },
  });
}

/**
 * تحديث بيانات فعالية موجودة.
 */
export async function updateEvent(db: PrismaClient, id: string, data: Prisma.EventUncheckedUpdateInput) {
  return db.event.update({
    where: { id },
    data,
  });
}

/**
 * حذف فعالية عبر معرفها.
 */
export async function deleteEvent(db: PrismaClient, id: string) {
  return db.event.delete({
    where: { id },
  });
}
