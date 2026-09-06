"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";

interface Budget {
  id: string;
  name: string;
  totalAmount: number;
  items: Array<{ id: string; name: string; amount: number }>;
}

export default function BudgetPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const router = useRouter();

  // جلب الميزانيات عند تحميل الصفحة.
  useEffect(() => {
    const fetchBudgets = async () => {
      try {
        const response = await fetch("/api/finance/budget");
        if (!response.ok) {
          throw new Error("فشل في جلب الميزانيات");
        }
        const data = await response.json();
        setBudgets(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error(error);
      }
    };

    fetchBudgets();
  }, []);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">إدارة الميزانيات</h1>

      <Button onClick={() => router.push("/finance/budget/new")}>إضافة ميزانية جديدة</Button>

      <div className="mt-4">
        <DataTable
          data={budgets}
          columns={[
            { header: "اسم الميزانية", accessor: "name" },
            { header: "المبلغ الكلي", accessor: "totalAmount" },
            { header: "عدد البنود", accessor: (row) => `${row.items.length}` },
          ]}
        />
      </div>
    </div>
  );
}