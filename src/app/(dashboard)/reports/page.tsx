"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function ReportsPage() {
  const router = useRouter();

  const downloadReport = async (reportName: string) => {
    try {
      const response = await fetch(`/api/reports/${reportName}`);
      if (!response.ok) {
        throw new Error("فشل في إنشاء التقرير");
      }

      const { success, message } = await response.json();
      if (success) {
        alert(message);
        // يمكن استخدام مكتبة لتحميل الملفات لاحقًا
      }
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء إنشاء التقرير");
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">إدارة التقارير</h1>

      <div className="space-y-4">
        <Button onClick={() => downloadReport("financial")}>
          تحميل التقرير المالي
        </Button>
        <Button onClick={() => downloadReport("donations")}>
          تحميل تقرير التبرعات
        </Button>
      </div>
    </div>
  );
}