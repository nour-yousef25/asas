import { NextResponse } from 'next/server';
import {
  getUserPermissions,
  updateUserPermissions,
} from '@/modules/users/permissions';

type RouteParams = {
  params: {
    id: string; // User ID
  };
};

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const permissions = await getUserPermissions(params.id);
    return NextResponse.json(permissions);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { permissionIds } = await request.json();

    if (!Array.isArray(permissionIds)) {
      return NextResponse.json({ message: 'permissionIds must be an array' }, { status: 400 });
    }

    await updateUserPermissions(params.id, permissionIds);

    return NextResponse.json({ message: 'Permissions updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}