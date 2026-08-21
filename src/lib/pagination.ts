export interface PaginationParams {
  page: number;
  pageSize: number;
  search?: string;
  searchFields?: string[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "10")));
  const search = searchParams.get("search") || undefined;
  const sortBy = searchParams.get("sortBy") || undefined;
  const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";

  return { page, pageSize, search, sortBy, sortOrder };
}

export function buildSearchCondition(
  search: string | undefined,
  searchFields: string[]
): any {
  if (!search || searchFields.length === 0) return {};

  return {
    OR: searchFields.map((field) => ({
      [field]: { contains: search, mode: "insensitive" },
    })),
  };
}

export function buildOrderBy(
  sortBy: string | undefined,
  sortOrder: "asc" | "desc",
  defaultSort: string = "createdAt"
): any {
  const field = sortBy || defaultSort;
  return { [field]: sortOrder };
}

export async function paginatedQuery<T>(
  findMany: (args: { where: any; orderBy: any; skip: number; take: number }) => Promise<T[]>,
  count: (args: { where: any }) => Promise<number>,
  where: any,
  params: PaginationParams,
  defaultSort: string = "createdAt"
): Promise<PaginatedResult<T>> {
  const { page, pageSize, sortBy, sortOrder } = params;
  const skip = (page - 1) * pageSize;

  const orderBy = buildOrderBy(sortBy, sortOrder ?? "desc", defaultSort);
  const [data, total] = await Promise.all([
    findMany({ where, orderBy, skip, take: pageSize }),
    count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
