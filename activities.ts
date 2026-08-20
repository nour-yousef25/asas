import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type ActivityCreateInput = {
  volunteerId: string;
  description: string;
  hours: number;
  activityDate: Date;
  eventId?: string;
  projectId?: string;
};

/**
 * Adds a new activity for a volunteer and updates their total hours.
 * @param data The data for the new activity.
 * @returns The created volunteer activity.
 */
export async function addVolunteerActivity(data: ActivityCreateInput) {
  const { volunteerId, hours, ...activityData } = data;

  // Use a transaction to ensure both operations (adding activity and updating total hours) succeed or fail together.
  const [activity] = await prisma.$transaction([
    prisma.volunteerActivity.create({
      data: {
        volunteerId,
        hours,
        ...activityData,
      },
    }),
    prisma.volunteer.update({
      where: { id: volunteerId },
      data: {
        totalHours: {
          increment: hours,
        },
      },
    }),
  ]);

  return activity;
}

/**
 * Retrieves all activities for a specific volunteer.
 * @param volunteerId The ID of the volunteer.
 * @returns A list of volunteer activities.
 */
export async function getVolunteerActivities(volunteerId: string) {
  return prisma.volunteerActivity.findMany({
    where: { volunteerId },
    orderBy: {
      activityDate: 'desc',
    },
  });
}

/**
 * Deletes a volunteer activity and deducts the hours from their total.
 * @param activityId The ID of the activity to delete.
 */
export async function deleteVolunteerActivity(activityId: string) {
  const activity = await prisma.volunteerActivity.findUnique({ where: { id: activityId } });

  if (!activity) {
    throw new Error("Activity not found");
  }

  await prisma.$transaction([
    prisma.volunteerActivity.delete({ where: { id: activityId } }),
    prisma.volunteer.update({
      where: { id: activity.volunteerId },
      data: { totalHours: { decrement: activity.hours } },
    }),
  ]);
}