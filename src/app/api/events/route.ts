import { NextRequest, NextResponse } from "next/server";
import * as EventService from "@/modules/events/events";

// استرجاع جميع الفعاليات
export async function GET() {
  try {
    const events = await EventService.getAllEvents();
    return NextResponse.json(events, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// إنشاء فعالية جديدة
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const newEvent = await EventService.createEvent(body);
    return NextResponse.json(newEvent, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
