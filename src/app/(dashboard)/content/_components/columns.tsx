"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ContentPage } from "@prisma/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

// This is a placeholder for the delete action.
// In a real implementation, this would trigger a mutation to the API.
async function deleteContentPage(id: string) {
  console.log(`Deleting page with id: ${id}`);
  // Example:
  // await fetch(`/api/content/pages/${id}`, { method: 'DELETE' });
  // You would also need to handle revalidation or state updates.
  alert(`سيتم حذف الصفحة رقم: ${id}`);
}

export const columns: ColumnDef<ContentPage>[] = [
  {
    accessorKey: "title",
    header: "العنوان",
    cell: ({ row }) => <div className="font-medium">{row.original.title}</div>,
  },
  {
    accessorKey: "slug",
    header: "الرابط (Slug)",
  },
  {
    accessorKey: "category",
    header: "الفئة",
    cell: ({ row }) => <Badge variant="outline">{row.original.category}</Badge>,
  },
  {
    accessorKey: "isPublished",
    header: "الحالة",
    cell: ({ row }) => {
      const isPublished = row.original.isPublished;
      return isPublished ? (
        <Badge>منشور</Badge>
      ) : (
        <Badge variant="secondary">مسودة</Badge>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "تاريخ الإنشاء",
    cell: ({ row }) => {
      return format(new Date(row.original.createdAt), "yyyy/MM/dd");
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const page = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">فتح القائمة</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>إجراءات</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/content/${page.id}/edit`}>تعديل</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(page.id)}
            >
              نسخ المعرّف (ID)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => deleteContentPage(page.id)}
            >
              حذف
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
