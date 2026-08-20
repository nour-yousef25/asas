import { PrismaClient, AttendanceStatus } from "@prisma/client";

const prisma = new PrismaClient();

export type AttendeeCreateInput = {
  eventId: string;
  userId?: string;
  beneficiaryId?: string;
  name?: string;
  phone?: string;
};

/**
 * Retrieves all attendees for a specific event.
 * @param eventId The ID of the event.
 * @returns A list of attendees for the event.
 */
export async function getEventAttendees(eventId: string) {
  return prisma.eventAttendance.findMany({
    where: { eventId },
    orderBy: {
      createdAt: 'asc',
    },
  });
}

/**
 * Adds a new attendee to an event.
 * @param data The data for the new attendee.
 * @returns The created attendance record.
 */
export async function addAttendee(data: AttendeeCreateInput) {
  return prisma.eventAttendance.create({
    data: {
      ...data,
      status: AttendanceStatus.REGISTERED,
    },
  });
}

/**
 * Updates the status of an attendee.
 * @param attendanceId The ID of the attendance record.
 * @param status The new status.
 * @returns The updated attendance record.
 */
export async function updateAttendeeStatus(attendanceId: string, status: AttendanceStatus) {
  return prisma.eventAttendance.update({
    where: { id: attendanceId },
    data: { status },
  });
}