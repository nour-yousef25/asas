import type { PrismaClient } from '@prisma/client';

export type ContentPageCreateInput = {
  title: string;
  slug: string;
  content: string;
  category: string;
  sortOrder?: number;
  isPublished?: boolean;
};

export type ContentPageUpdateInput = {
  title?: string;
  slug?: string;
  content?: string;
  category?: string;
  sortOrder?: number;
  isPublished?: boolean;
};

/**
 * Creates a new content page.
 * @param db The tenant-bound Prisma client.
 * @param data The data for the new content page.
 * @returns The created content page.
 */
export async function createPage(db: PrismaClient, data: ContentPageCreateInput) {
  return db.contentPage.create({ data });
}

/**
 * Updates an existing content page.
 * @param db The tenant-bound Prisma client.
 * @param id The ID of the content page to update.
 * @param data The data to update the content page with.
 * @returns The updated content page.
 */
export async function updatePage(db: PrismaClient, id: string, data: ContentPageUpdateInput) {
  return db.contentPage.update({
    where: { id },
    data,
  });
}

/**
 * Retrieves a content page by its slug.
 * @param db The tenant-bound Prisma client.
 * @param slug The slug of the content page to retrieve.
 * @returns The content page, or null if not found.
 */
export async function getPageBySlug(db: PrismaClient, slug: string) {
  return db.contentPage.findUnique({
    where: { slug },
  });
}

/**
 * Retrieves all content pages.
 * @param db The tenant-bound Prisma client.
 * @returns A list of all content pages.
 */
export async function getAllPages(db: PrismaClient) {
  return db.contentPage.findMany();
}

/**
 * Retrieves a content page by its ID.
 * @param db The tenant-bound Prisma client.
 * @param id The ID of the content page to retrieve.
 * @returns The content page, or null if not found.
 */
export async function getPageById(db: PrismaClient, id: string) {
  return db.contentPage.findUnique({
    where: { id },
  });
}

/**
 * Deletes a content page by its ID.
 * @param db The tenant-bound Prisma client.
 * @param id The ID of the content page to delete.
 */
export async function deletePage(db: PrismaClient, id: string) {
  return db.contentPage.delete({ where: { id } });
}
