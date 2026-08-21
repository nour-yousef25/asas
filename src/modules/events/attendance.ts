/**
 * وظائف إدارة الحضور للفعاليات.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type AttendanceCreateInput = {
  eventId: string;
  userId: string;
  status: "ATTENDED" | "ABSENT";
};

/**
 * تسجيل حالة حضور جديدة لفعالية.
 */
export async function createAttendance(data: AttendanceCreateInput) {
  return prisma.eventAttendance.create({
    data,
  });
}

/**
 * تحديث حالة الحضور لفعالية.
 */
export async function updateAttendance(id: string, data: Partial<AttendanceCreateInput>) {
  return prisma.eventAttendance.update({
    where: { id },
    data,
  });
}

/**
 * جلب قائمة الحضور لفعالية معينة.
 */
export async function getAttendanceByEvent(eventId: string) {
  return prisma.eventAttendance.findMany({
    where: { eventId },
  });
}

/**
 * حذف تسجيل حضور.
 */
export async function deleteAttendance(id: string) {
  return prisma.eventAttendance.delete({
    where: { id },
  });
}
