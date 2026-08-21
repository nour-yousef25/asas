"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type DataTableColumn<T> = {
  header: React.ReactNode;
  accessor: keyof T | ((row: T) => React.ReactNode);
};

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  emptyMessage?: string;
  getRowKey?: (row: T, index: number) => React.Key;
}

function readCell<T>(row: T, accessor: DataTableColumn<T>["accessor"]) {
  if (typeof accessor === "function") {
    return accessor(row);
  }

  const value = row[accessor];
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? "نعم" : "لا";
  }

  return String(value);
}

export function DataTable<T>({
  data,
  columns,
  emptyMessage = "لا توجد بيانات للعرض.",
  getRowKey,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card text-card-foreground" dir="rtl">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column, index) => (
              <TableHead key={`${String(column.header)}-${index}`}>{column.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, rowIndex) => (
              <TableRow key={getRowKey?.(row, rowIndex) ?? rowIndex}>
                {columns.map((column, columnIndex) => (
                  <TableCell key={`${rowIndex}-${columnIndex}`}>{readCell(row, column.accessor)}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
