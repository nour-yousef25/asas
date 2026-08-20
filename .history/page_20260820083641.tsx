import { getAllExpenses } from "@/modules/finance/expenses";
import { PlusCircle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { columns } from "./_components/columns";

export default async function ExpensesPage() {
  const expenses = await getAllExpenses();

  return (
    <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <div className="flex items-center">
        <div className="ml-auto flex items-center gap-2">
          <Link href="/finance/expenses/new">
            <Button size="sm" className="h-8 gap-1">
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                إضافة مصروف جديد
              </span>
            </Button>
          </Link>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>إدارة المصروفات</CardTitle>
          <CardDescription>
            عرض وتسجيل كافة المصروفات التشغيلية للمنظمة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={expenses} />
        </CardContent>
      </Card>
    </main>
  );
}