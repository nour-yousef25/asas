import { PrismaClient, Event } from "@prisma/client";

const prisma = new PrismaClient();

export type EventCreateInput = Omit<Event, 'id' | 'createdAt' | 'updatedAt'>;
export type EventUpdateInput = Partial<EventCreateInput>;

/**
 * Creates a new event.
 * @param data The data for the new event.
 * @returns The created event.
 */
export async function createEvent(data: EventCreateInput) {
  return prisma.event.create({ data });
}

/**
 * Retrieves all events, ordered by start date.
 * @returns A list of all events.
 */
export async function getAllEvents() {
  return prisma.event.findMany({
    orderBy: {
      startDate: 'desc',
    },
  });
}

/**
 * Retrieves a single event by its ID.
 * @param id The ID of the event to retrieve.
 * @returns The event, or null if not found.
 */
export async function getEventById(id: string) {
  return prisma.event.findUnique({
    where: { id },
  });
}

/**
 * Updates an existing event.
 * @param id The ID of the event to update.
 * @param data The data to update the event with.
 * @returns The updated event.
 */
export async function updateEvent(id: string, data: EventUpdateInput) {
  return prisma.event.update({
    where: { id },
    data,
  });
}

/**
 * Deletes an event.
 * @param id The ID of the event to delete.
 */
export async function deleteEvent(id: string) {
  return prisma.event.delete({ where: { id } });
}