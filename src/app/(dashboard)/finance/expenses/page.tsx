"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";

interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
}

export default function ExpensesPage({ params }: { params: { budgetItemId: string } }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const router = useRouter();

  // جلب المصروفات عند تحميل الصفحة
  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        const response = await fetch(`/api/finance/expenses?budgetItemId=${params.budgetItemId}`);
        if (!response.ok) {
          throw new Error("فشل في جلب المصروفات");
        }
        const data = await response.json();
        setExpenses(data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchExpenses();
  }, [params.budgetItemId]);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">إدارة المصروفات</h1>

      <Button onClick={() => router.push("/finance/expenses/new")}>إضافة مصروف جديد</Button>

      <div className="mt-4">
        <DataTable
          data={expenses}
          columns={[
            { header: "الوصف", accessor: "description" },
            { header: "المبلغ", accessor: "amount" },
            { header: "التاريخ", accessor: "date" },
          ]}
        />
      </div>
    </div>
  );
}