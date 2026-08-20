"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Expense, BudgetItem } from "@prisma/client";
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

type ExpenseWithBudgetItem = Expense & { budgetItem: BudgetItem | null };

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
  }).format(amount);
}

export const columns: ColumnDef<ExpenseWithBudgetItem>[] = [
  {
    accessorKey: "expenseDate",
    header: "تاريخ الصرف",
    cell: ({ row }) => new Date(row.getValue("expenseDate")).toLocaleDateString('ar-SA'),
  },
  {
    accessorKey: "title",
    header: "البيان",
  },
  {
    accessorKey: "amount",
    header: "المبلغ",
    cell: ({ row }) => formatCurrency(row.getValue("amount")),
  },
  {
    accessorKey: "budgetItem.category",
    header: "بند الميزانية",
    cell: ({ row }) => row.original.budgetItem?.category || <span className="text-muted-foreground">غير مرتبط</span>,
  },
  {
    accessorKey: "status",
    header: "الحالة",
    cell: ({ row }) => <Badge variant="outline">{row.getValue("status")}</Badge>,
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
          <DropdownMenuItem>عرض التفاصيل</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];