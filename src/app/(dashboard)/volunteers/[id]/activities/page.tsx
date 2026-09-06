"use client";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { VolunteerActivityCreateInput } from "@/modules/volunteers/activities";

interface Activity {
  id: string;
  description: string;
  hours: number;
  date: string; // Expecting ISO String from the backend
}

export default function VolunteerActivitiesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);

  // Fetch activities when the component loads
  useEffect(() => {
    const loadActivities = async () => {
      try {
        const response = await fetch(`/api/volunteers/${id}/activities`);
        if (!response.ok) {
          throw new Error("Failed to fetch activities");
        }
        const data = await response.json();
        setActivities(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error(error);
      }
    };

    loadActivities();
  }, [id]);

  // Add a new activity (placeholder function for form submission)
  const addActivity = async (activity: VolunteerActivityCreateInput) => {
    try {
      const response = await fetch(`/api/volunteers/${id}/activities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(activity),
      });
      if (!response.ok) {
        throw new Error("Failed to add activity");
      }
      router.refresh();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">الأنشطة التطوعية</h1>

      <Button onClick={() => router.push(`/volunteers/${id}/activities/new`)}>
        إضافة نشاط جديد
      </Button>

      <div className="mt-4">
        <DataTable
          data={activities}
          columns={[
            { header: "الوصف", accessor: "description" },
            { header: "عدد الساعات", accessor: "hours" },
            { header: "التاريخ", accessor: "date" },
          ]}
        />
      </div>
    </div>
  );
}
