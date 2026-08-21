"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";

interface Attendance {
  id: string;
  user: { name: string; email: string };
  status: "ATTENDED" | "ABSENT";
}

export default function AttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [attendanceList, setAttendanceList] = useState<Attendance[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const response = await fetch(`/api/events/${id}/attendance`);
        if (!response.ok) {
          throw new Error("فشل في جلب قائمة الحضور");
        }
        const data = await response.json();
        setAttendanceList(data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchAttendance();
  }, [id]);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">إدارة حضور الفعالية</h1>

      <Button onClick={() => router.push(`/events/${id}/attendance/new`)}>
        تسجيل حضور جديد
      </Button>

      <div className="mt-4">
        <DataTable
          data={attendanceList}
          columns={[
            { header: "اسم المستخدم", accessor: (row) => row.user.name },
            { header: "البريد الإلكتروني", accessor: (row) => row.user.email },
            { header: "الحالة", accessor: "status" },
          ]}
        />
      </div>
    </div>
  );
}
