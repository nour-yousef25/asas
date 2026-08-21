import { NextRequest, NextResponse } from "next/server";
import * as AttendanceService from "@/modules/events/attendance";

// استرجاع قائمة الحضور لفعالية معينة
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const attendanceList = await AttendanceService.getAttendanceByEvent(id);
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

    const newAttendance = await AttendanceService.createAttendance({
      eventId: id,
      ...body,
    });

    return NextResponse.json(newAttendance, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
