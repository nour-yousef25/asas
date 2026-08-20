import { NextResponse } from 'next/server';
import { createRole, getAllRoles } from '@/modules/users/roles';

export async function GET() {
  try {
    const roles = await getAllRoles();
    return NextResponse.json(roles);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const newRole = await createRole(data);
    return NextResponse.json(newRole, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}