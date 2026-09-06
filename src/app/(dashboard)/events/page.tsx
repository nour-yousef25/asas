"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";

interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const router = useRouter();

  // جلب قائمة الفعاليات
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch("/api/events");
        if (!response.ok) {
          throw new Error("فشل في جلب الفعاليات");
        }
        const data = await response.json();
        setEvents(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error(error);
      }
    };

    fetchEvents();
  }, []);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">إدارة الفعاليات</h1>

      <Button onClick={() => router.push("/events/new")}>إضافة فعالية جديدة</Button>

      <div className="mt-4">
        <DataTable
          data={events}
          columns={[
            { header: "اسم الفعالية", accessor: "name" },
            { header: "التاريخ", accessor: "date" },
            { header: "الموقع", accessor: "location" },
          ]}
        />
      </div>
    </div>
  );
}