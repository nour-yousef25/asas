import { NextRequest, NextResponse } from "next/server";
import * as VolunteerService from "@/modules/volunteers/activities";
import { queryTenantApi, isTenantApiError } from "@/lib/tenant-query";

// استرجاع كل الأنشطة المرتبطة بمتطوع معين
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const activities = await queryTenantApi((db) =>
      VolunteerService.getVolunteerActivities(db, id),
    );
    if (isTenantApiError(activities)) return activities;
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

    const newActivity = await queryTenantApi((db) =>
      VolunteerService.createActivity(db, { volunteerId: id, ...body }),
    );
    if (isTenantApiError(newActivity)) return newActivity;
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

    const updatedActivity = await queryTenantApi((db) =>
      VolunteerService.updateActivity(db, id, body),
    );
    if (isTenantApiError(updatedActivity)) return updatedActivity;
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
    const result = await queryTenantApi((db) =>
      VolunteerService.deleteActivity(db, id),
    );
    if (isTenantApiError(result)) return result;
    return NextResponse.json({ message: "Activity deleted successfully" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
