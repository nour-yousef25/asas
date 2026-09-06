/**
 * وظائف إدارة الحضور للفعاليات.
 */
import type { PrismaClient } from "@prisma/client";

export type AttendanceCreateInput = {
  eventId: string;
  userId: string;
  status: "ATTENDED" | "ABSENT";
};

/**
 * تسجيل حالة حضور جديدة لفعالية.
 */
export async function createAttendance(db: PrismaClient, data: AttendanceCreateInput) {
  return db.eventAttendance.create({
    data,
  });
}

/**
 * تحديث حالة الحضور لفعالية.
 */
export async function updateAttendance(db: PrismaClient, id: string, data: Partial<AttendanceCreateInput>) {
  return db.eventAttendance.update({
    where: { id },
    data,
  });
}

/**
 * جلب قائمة الحضور لفعالية معينة.
 */
export async function getAttendanceByEvent(db: PrismaClient, eventId: string) {
  return db.eventAttendance.findMany({
    where: { eventId },
  });
}

/**
 * حذف تسجيل حضور.
 */
export async function deleteAttendance(db: PrismaClient, id: string) {
  return db.eventAttendance.delete({
    where: { id },
  });
}
