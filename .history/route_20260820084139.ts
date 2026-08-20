import { NextResponse } from 'next/server';
import {
  getEventById,
  updateEvent,
  deleteEvent,
} from '@/modules/events/events';

type RouteParams = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const event = await getEventById(params.id);
    if (!event) {
      return NextResponse.json({ message: 'Event not found' }, { status: 404 });
    }
    return NextResponse.json(event);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const data = await request.json();
    const updatedEvent = await updateEvent(params.id, data);
    return NextResponse.json(updatedEvent);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    await deleteEvent(params.id);
    return NextResponse.json({ message: 'Event deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}