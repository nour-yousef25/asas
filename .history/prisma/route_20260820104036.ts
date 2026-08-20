import { NextResponse } from 'next/server';
import { createDonation } from '@/modules/donations/donations';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const newDonation = await createDonation(data);
    return NextResponse.json(newDonation, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}