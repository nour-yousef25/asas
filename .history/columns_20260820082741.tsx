"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Budget, BudgetItem } from "@prisma/client";
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
import { useRouter } from "next/navigation";

type BudgetWithItems = Budget & { items: BudgetItem[] };

async function deleteBudgetAction(id: string) {
  const response = await fetch(`/api/finance/budget/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error("Failed to delete budget");
  }
}

export const columns: ColumnDef<BudgetWithItems>[] = [
  {
    accessorKey: "fiscalYear",
    header: "السنة المالية",
  },
  {
    accessorKey: "title",
    header: "العنوان",
  },
  {
    accessorKey: "totalAmount",
    header: "المبلغ المعتمد",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("totalAmount"));
      return new Intl.NumberFormat("ar-SA", {
        style: "currency",
        currency: "SAR",
      }).format(amount);
    },
  },
  {
    accessorKey: "spentAmount",
    header: "المبلغ المصروف",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("spentAmount"));
      return new Intl.NumberFormat("ar-SA", {
        style: "currency",
        currency: "SAR",
      }).format(amount);
    },
  },
  {
    accessorKey: "status",
    header: "الحالة",
    cell: ({ row }) => <Badge>{row.getValue("status")}</Badge>,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const budget = row.original;
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
            <DropdownMenuItem asChild>
              <Link href={`/finance/budget/${budget.id}`}>عرض التفاصيل</Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600" onClick={async () => {
              await deleteBudgetAction(budget.id);
              router.refresh();
            }}>حذف</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];