"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Role } from "@prisma/client";
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

type RoleWithCounts = Role & {
  _count: {
    users: number;
    permissions: number;
  };
};

async function deleteRoleAction(id: string) {
  const response = await fetch(`/api/users/roles/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error("Failed to delete role");
  }
}

export const columns: ColumnDef<RoleWithCounts>[] = [
  {
    accessorKey: "name",
    header: "اسم الدور",
  },
  {
    accessorKey: "description",
    header: "الوصف",
    cell: ({ row }) => row.getValue("description") || <span className="text-muted-foreground">لا يوجد وصف</span>,
  },
  {
    accessorKey: "_count.permissions",
    header: "عدد الصلاحيات",
    cell: ({ row }) => row.original._count.permissions,
  },
  {
    accessorKey: "_count.users",
    header: "عدد المستخدمين",
    cell: ({ row }) => row.original._count.users,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const role = row.original;
      const router = useRouter();

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">فتح القائمة</span><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
            <DropdownMenuItem asChild><Link href={`/users/roles/${role.id}/edit`}>تعديل</Link></DropdownMenuItem>
            <DropdownMenuItem className="text-red-600" onClick={async () => { await deleteRoleAction(role.id); router.refresh(); }}>حذف</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];