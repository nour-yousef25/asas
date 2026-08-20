import { getEventById } from "@/modules/events/events";
import { getEventAttendees } from "@/modules/events/attendance";
import { notFound } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// This would ideally be a client component with form handling
function AddAttendeeForm({ eventId }: { eventId: string }) {
  return (
    <div className="p-4 border rounded-lg bg-muted/40">
      <p className="font-semibold">إضافة حاضر جديد</p>
      <p className="text-sm text-muted-foreground">
        (سيتم هنا بناء نموذج متكامل للبحث عن أعضاء أو إضافة ضيوف)
      </p>
    </div>
  );
}

const prisma = new PrismaClient();

async function getFullAttendees(eventId: string) {
    const attendees = await prisma.eventAttendance.findMany({
        where: { eventId },
        include: {
            // These relations don't exist on EventAttendance model directly
            // but this shows the intent to get user/beneficiary name
        }
    });

    // In a real scenario, you'd fetch user/beneficiary names separately
    // and map them to the attendees. For now, we'll use the stored name.
    const users = await prisma.user.findMany({
        where: { id: { in: attendees.map(a => a.userId).filter((id): id is string => !!id) } }
    });

    const beneficiaries = await prisma.beneficiary.findMany({
        where: { id: { in: attendees.map(a => a.beneficiaryId).filter((id): id is string => !!id) } }
    });

    const userMap = new Map(users.map(u => [u.id, u.name]));
    const beneficiaryMap = new Map(beneficiaries.map(b => [b.id, b.name]));

    return attendees.map(att => ({
        ...att,
        displayName: att.userId ? userMap.get(att.userId) : (att.beneficiaryId ? beneficiaryMap.get(att.beneficiaryId) : att.name),
        displayPhone: att.phone,
    }));
}


type AttendancePageProps = {
  params: {
    id: string;
  };
};

export default async function EventAttendancePage({ params }: AttendancePageProps) {
  const event = await getEventById(params.id);

  if (!event) {
    notFound();
  }

  const attendees = await getFullAttendees(params.id);

  return (
    <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>سجل الحضور: {event.title}</CardTitle>
              <CardDescription>
                إدارة الحضور للفعالية. العدد الحالي: {attendees.length} / {event.capacity || 'غير محدد'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>رقم الجوال</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendees.map((attendee) => (
                    <TableRow key={attendee.id}>
                      <TableCell className="font-medium">{attendee.displayName || 'غير مسجل'}</TableCell>
                      <TableCell>{attendee.displayPhone || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={attendee.status === 'ATTENDED' ? 'default' : 'secondary'}>
                          {attendee.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {/* Actions like 'Mark as Attended' would be here */}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        <div>
          <AddAttendeeForm eventId={event.id} />
        </div>
      </div>
    </main>
  );
}