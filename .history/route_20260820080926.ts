import { NextResponse } from 'next/server';
import { deleteVolunteerActivity } from '@/modules/volunteers/activities';

type RouteParams = {
  params: {
    activityId: string;
  };
};

/**
 * DELETE /api/volunteers/activities/[activityId]
 * Deletes a specific volunteer activity.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    await deleteVolunteerActivity(params.activityId);
    return NextResponse.json({ message: 'Activity deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}