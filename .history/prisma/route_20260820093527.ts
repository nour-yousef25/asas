import { NextResponse } from 'next/server';
import {
  getRoleById,
  updateRole,
  deleteRole,
} from '@/modules/users/roles';

type RouteParams = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const role = await getRoleById(params.id);
    if (!role) {
      return NextResponse.json({ message: 'Role not found' }, { status: 404 });
    }
    return NextResponse.json(role);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const data = await request.json();
    const updatedRole = await updateRole(params.id, data);
    return NextResponse.json(updatedRole);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    await deleteRole(params.id);
    return NextResponse.json({ message: 'Role deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}