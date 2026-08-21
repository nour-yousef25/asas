import { NextRequest, NextResponse } from "next/server";
import * as VolunteerService from "@/modules/volunteers/activities";

// استرجاع كل الأنشطة المرتبطة بمتطوع معين
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const activities = await VolunteerService.getVolunteerActivities(id);
    return NextResponse.json(activities, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// إضافة نشاط جديد
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const newActivity = await VolunteerService.createActivity({
      volunteerId: id,
      ...body,
    });

    return NextResponse.json(newActivity, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// تحديث نشاط موجود
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updatedActivity = await VolunteerService.updateActivity(id, body);

    return NextResponse.json(updatedActivity, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// حذف نشاط
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await VolunteerService.deleteActivity(id);

    return NextResponse.json({ message: "Activity deleted successfully" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
