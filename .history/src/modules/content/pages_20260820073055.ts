import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
 * @param data The data for the new content page.
 * @returns The created content page.
 */
export async function createPage(data: ContentPageCreateInput) {
  return prisma.contentPage.create({ data });
}

/**
 * Updates an existing content page.
 * @param id The ID of the content page to update.
 * @param data The data to update the content page with.
 * @returns The updated content page.
 */
export async function updatePage(id: string, data: ContentPageUpdateInput) {
  return prisma.contentPage.update({
    where: { id },
    data,
  });
}

/**
 * Retrieves a content page by its slug.
 * @param slug The slug of the content page to retrieve.
 * @returns The content page, or null if not found.
 */
export async function getPageBySlug(slug: string) {
  return prisma.contentPage.findUnique({
    where: { slug },
  });
}

/**
 * Retrieves all content pages.
 * @returns A list of all content pages.
 */
export async function getAllPages() {
  return prisma.contentPage.findMany();
}

/**
 * Retrieves a content page by its ID.
 * @param id The ID of the content page to retrieve.
 * @returns The content page, or null if not found.
 */
export async function getPageById(id: string) {
  return prisma.contentPage.findUnique({
    where: { id },
  });
}

/**
 * Deletes a content page by its ID.
 * @param id The ID of the content page to delete.
 */
export async function deletePage(id: string) {
  return prisma.contentPage.delete({ where: { id } });
}
