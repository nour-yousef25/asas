import { NextResponse } from 'next/server';
import { getAllPermissions } from '@/modules/users/permissions';

export async function GET() {
  try {
    const permissions = await getAllPermissions();
    return NextResponse.json(permissions);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}