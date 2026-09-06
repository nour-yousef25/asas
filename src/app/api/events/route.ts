import { NextRequest, NextResponse } from "next/server";
import * as EventService from "@/modules/events/events";
import { queryTenantApi, isTenantApiError } from "@/lib/tenant-query";

// استرجاع جميع الفعاليات
export async function GET() {
  try {
    const events = await queryTenantApi((db, context) =>
      db.event.findMany({ where: { organizationId: context.organizationId } }),
    );
    if (isTenantApiError(events)) return events;
    return NextResponse.json(events, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// إنشاء فعالية جديدة
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const newEvent = await queryTenantApi((db, context) =>
      EventService.createEvent(db, { ...body, organizationId: context.organizationId }),
    );
    if (isTenantApiError(newEvent)) return newEvent;
    return NextResponse.json(newEvent, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
