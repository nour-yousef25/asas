import { PrismaClient } from "@prisma/client";
import { notFound } from "next/navigation";
import { getVolunteerActivities } from "@/modules/volunteers/activities";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { columns } from "./_components/columns";
import { ActivityForm } from "./_components/activity-form";

const prisma = new PrismaClient();

type VolunteerActivitiesPageProps = {
  params: {
    id: string;
  };
};

export default async function VolunteerActivitiesPage({ params }: VolunteerActivitiesPageProps) {
  const volunteer = await prisma.volunteer.findUnique({
    where: { id: params.id },
    include: { user: true },
  });

  if (!volunteer) {
    notFound();
  }

  const activities = await getVolunteerActivities(params.id);

  return (
    <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>تسجيل نشاط جديد</CardTitle>
            <CardDescription>
              للمتطوع: {volunteer.user.name} (إجمالي الساعات: {volunteer.totalHours})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityForm volunteerId={volunteer.id} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>سجل الأنشطة</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={activities} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}