import { NextRequest, NextResponse } from "next/server";
import * as AttendanceService from "@/modules/events/attendance";
import { queryTenantApi, isTenantApiError } from "@/lib/tenant-query";

// استرجاع قائمة الحضور لفعالية معينة
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const attendanceList = await queryTenantApi((db, context) =>
      db.event.findFirst({ where: { id, organizationId: context.organizationId } })
        .then((event) => (event ? AttendanceService.getAttendanceByEvent(db, id) : null)),
    );
    if (isTenantApiError(attendanceList)) return attendanceList;
    if (attendanceList === null) {
      return NextResponse.json({ error: "الفعالية غير موجودة" }, { status: 404 });
    }
    return NextResponse.json(attendanceList, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// تسجيل حضور جديد
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const newAttendance = await queryTenantApi(async (db, context) => {
      const event = await db.event.findFirst({ where: { id, organizationId: context.organizationId } });
      if (!event) return null;
      return AttendanceService.createAttendance(db, { eventId: id, ...body });
    });
    if (isTenantApiError(newAttendance)) return newAttendance;
    if (newAttendance === null) {
      return NextResponse.json({ error: "الفعالية غير موجودة" }, { status: 404 });
    }
    return NextResponse.json(newAttendance, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
