"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: {
    key: string;
    header: string;
    render?: (row: T) => React.ReactNode;
    className?: string;
  }[];
  searchable?: boolean;
  searchKeys?: (keyof T)[];
  emptyMessage?: string;
  pageSize?: number;
  pagination?: Pagination;
  onPageChange?: (page: number) => void;
  onSearch?: (search: string) => void;
  loading?: boolean;
}

export function DataTable<T extends { id?: string }>({
  data,
  columns,
  searchable = false,
  searchKeys,
  emptyMessage = "لا توجد بيانات",
  pageSize = 10,
  pagination,
  onPageChange,
  onSearch,
  loading = false,
}: DataTableProps<T>) {
  const [localSearch, setLocalSearch] = React.useState("");
  const [localPage, setLocalPage] = React.useState(1);

  const isServerSide = !!pagination && !!onPageChange;

  const handleSearch = React.useCallback(
    (value: string) => {
      if (onSearch) {
        onSearch(value);
      } else {
        setLocalSearch(value);
        setLocalPage(1);
      }
    },
    [onSearch]
  );

  const filtered = React.useMemo(() => {
    if (isServerSide) return data;
    if (!localSearch) return data;
    return data.filter((row) => {
      const keys = searchKeys || (Object.keys(row as object) as (keyof T)[]);
      return keys.some((k) =>
        String((row as any)[k] ?? "")
          .toLowerCase()
          .includes(localSearch.toLowerCase())
      );
    });
  }, [data, localSearch, searchKeys, isServerSide]);

  const effectivePagination = isServerSide
    ? pagination
    : {
        page: localPage,
        pageSize,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / pageSize),
        hasNext: localPage < Math.ceil(filtered.length / pageSize),
        hasPrev: localPage > 1,
      };

  const paginated = isServerSide
    ? filtered
    : filtered.slice(
        (localPage - 1) * pageSize,
        localPage * pageSize
      );

  const handlePageChange = (newPage: number) => {
    if (isServerSide) {
      onPageChange(newPage);
    } else {
      setLocalPage(newPage);
    }
  };

  return (
    <div className="space-y-3">
      {searchable && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="بحث..."
            value={isServerSide ? localSearch : localSearch}
            onChange={(e) => handleSearch(e.target.value)}
            className="max-w-xs"
          />
          <span className="text-sm text-muted-foreground">
            {effectivePagination.total} عنصر
          </span>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-4 py-3 text-right font-medium text-muted-foreground",
                    c.className
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    جاري التحميل...
                  </div>
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginated.map((row, i) => (
                <tr
                  key={(row as any).id || i}
                  className="border-t hover:bg-muted/30"
                >
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      {c.render
                        ? c.render(row)
                        : (row as any)[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {effectivePagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            صفحة {effectivePagination.page} من {effectivePagination.totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(effectivePagination.page - 1)}
              disabled={!effectivePagination.hasPrev}
            >
              السابق
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(effectivePagination.page + 1)}
              disabled={!effectivePagination.hasNext}
            >
              التالي
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
