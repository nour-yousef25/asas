"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ContentPage } from "@prisma/client";

export const columns: ColumnDef<ContentPage>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          العنوان
          <ArrowUpDown className="mr-2 h-4 w-4" />
        </Button>
      );
    },
  },
  {
    accessorKey: "category",
    header: "التصنيف",
  },
  {
    accessorKey: "isPublished",
    header: "الحالة",
    cell: ({ row }) => {
      const isPublished = row.getValue("isPublished");
      return (
        <Badge variant={isPublished ? "default" : "outline"}>
          {isPublished ? "منشور" : "مسودة"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "updatedAt",
    header: "آخر تحديث",
    cell: ({ row }) => {
      return new Date(row.getValue("updatedAt")).toLocaleDateString("ar-SA");
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
            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/content/${page.id}/edit`}>تعديل</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => alert(`سيتم حذف: ${page.title}`)}
              className="text-red-600"
            >
              حذف
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];