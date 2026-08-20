"use client";

import { ColumnDef } from "@tanstack/react-table";
import { VolunteerActivity } from "@prisma/client";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";

async function deleteActivity(activityId: string) {
  const response = await fetch(`/api/volunteers/activities/${activityId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error("Failed to delete activity");
  }
}

export const columns: ColumnDef<VolunteerActivity>[] = [
  {
    accessorKey: "activityDate",
    header: "تاريخ النشاط",
    cell: ({ row }) => new Date(row.getValue("activityDate")).toLocaleDateString('ar-SA'),
  },
  {
    accessorKey: "description",
    header: "وصف النشاط",
  },
  {
    accessorKey: "hours",
    header: "عدد الساعات",
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const activity = row.original;
      const router = useRouter();

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
            <DropdownMenuItem
              className="text-red-600"
              onClick={async () => {
                await deleteActivity(activity.id);
                router.refresh();
              }}
            >
              حذف
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];