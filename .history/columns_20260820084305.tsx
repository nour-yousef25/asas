"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Event } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";

async function deleteEventAction(id: string) {
  const response = await fetch(`/api/events/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error("Failed to delete event");
  }
}

export const columns: ColumnDef<Event>[] = [
  {
    accessorKey: "title",
    header: "الفعالية",
  },
  {
    accessorKey: "startDate",
    header: "تاريخ البدء",
    cell: ({ row }) => new Date(row.getValue("startDate")).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' }),
  },
  {
    accessorKey: "location",
    header: "المكان",
  },
  {
    accessorKey: "status",
    header: "الحالة",
    cell: ({ row }) => <Badge variant="outline">{row.getValue("status")}</Badge>,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const event = row.original;
      const router = useRouter();

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/events/${event.id}/edit`}>تعديل</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/events/${event.id}/attendance`}>تسجيل الحضور</Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600" onClick={async () => { await deleteEventAction(event.id); router.refresh(); }}>حذف</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];