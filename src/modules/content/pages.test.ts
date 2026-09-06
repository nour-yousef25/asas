import {
  createPage,
  updatePage,
  getPageBySlug,
  getAllPages,
  ContentPageCreateInput,
  ContentPageUpdateInput,
} from './pages';
import { PrismaClient } from '@prisma/client';

// Mock the PrismaClient
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    contentPage: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mockPrismaClient) };
});

const prisma = new PrismaClient();

describe('Content Page Module', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
  });

  describe('createPage', () => {
    it('should create a new content page', async () => {
      const newPageData: ContentPageCreateInput = {
        title: 'Test Page',
        slug: 'test-page',
        content: 'This is a test page.',
        category: 'Tests',
      };
      const createdPage = { id: '1', ...newPageData, createdAt: new Date(), updatedAt: new Date(), sortOrder: 0, isPublished: false };
      (prisma.contentPage.create as jest.Mock).mockResolvedValue(createdPage);

      await expect(createPage(prisma as unknown as PrismaClient, newPageData)).resolves.toEqual(createdPage);
      expect(prisma.contentPage.create).toHaveBeenCalledWith({ data: newPageData });
    });
  });

  describe('updatePage', () => {
    it('should update an existing content page', async () => {
      const pageId = '1';
      const updateData: ContentPageUpdateInput = { title: 'Updated Test Page' };
      const updatedPage = { id: pageId, title: 'Updated Test Page', slug: 'test-page', content: 'This is a test page.', category: 'Tests', createdAt: new Date(), updatedAt: new Date(), sortOrder: 0, isPublished: false };
      (prisma.contentPage.update as jest.Mock).mockResolvedValue(updatedPage);

      await expect(updatePage(prisma as unknown as PrismaClient, pageId, updateData)).resolves.toEqual(updatedPage);
      expect(prisma.contentPage.update).toHaveBeenCalledWith({
        where: { id: pageId },
        data: updateData,
      });
    });

    it('should return null if page to update does not exist', async () => {
      const pageId = 'nonexistent';
      const updateData: ContentPageUpdateInput = { title: 'Updated Test Page' };
      (prisma.contentPage.update as jest.Mock).mockRejectedValue(new Error('Record not found'));

      await expect(updatePage(prisma as unknown as PrismaClient, pageId, updateData)).rejects.toThrow('Record not found');
    });
  });

  describe('getPageBySlug', () => {
    it('should retrieve a content page by slug', async () => {
      const pageSlug = 'test-page';
      const foundPage = { id: '1', title: 'Test Page', slug: pageSlug, content: 'This is a test page.', category: 'Tests', createdAt: new Date(), updatedAt: new Date(), sortOrder: 0, isPublished: false };
      (prisma.contentPage.findUnique as jest.Mock).mockResolvedValue(foundPage);

      await expect(getPageBySlug(prisma as unknown as PrismaClient, pageSlug)).resolves.toEqual(foundPage);
      expect(prisma.contentPage.findUnique).toHaveBeenCalledWith({ where: { slug: pageSlug } });
    });

    it('should return null if page with slug does not exist', async () => {
      const pageSlug = 'nonexistent-page';
      (prisma.contentPage.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(getPageBySlug(prisma as unknown as PrismaClient, pageSlug)).resolves.toBeNull();
      expect(prisma.contentPage.findUnique).toHaveBeenCalledWith({ where: { slug: pageSlug } });
    });
  });

  describe('getAllPages', () => {
    it('should retrieve all content pages', async () => {
      const allPages = [
        { id: '1', title: 'Page 1', slug: 'page-1', content: 'Content 1', category: 'Cat1', createdAt: new Date(), updatedAt: new Date(), sortOrder: 0, isPublished: false },
        { id: '2', title: 'Page 2', slug: 'page-2', content: 'Content 2', category: 'Cat2', createdAt: new Date(), updatedAt: new Date(), sortOrder: 0, isPublished: false },
      ];
      (prisma.contentPage.findMany as jest.Mock).mockResolvedValue(allPages);

      await expect(getAllPages(prisma as unknown as PrismaClient)).resolves.toEqual(allPages);
      expect(prisma.contentPage.findMany).toHaveBeenCalledTimes(1);
    });

    it('should return an empty array if no pages exist', async () => {
      (prisma.contentPage.findMany as jest.Mock).mockResolvedValue([]);

      await expect(getAllPages(prisma as unknown as PrismaClient)).resolves.toEqual([]);
      expect(prisma.contentPage.findMany).toHaveBeenCalledTimes(1);
    });
  });
});

