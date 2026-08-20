import { NextResponse } from 'next/server';
import { renewMembership } from '@/modules/members/renewal';

type RouteParams = {
  params: {
    id: string;
  };
};

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { newExpiryDate, paymentAmount, paymentMethod } = await request.json();

    if (!newExpiryDate || !paymentAmount || !paymentMethod) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const updatedMember = await renewMembership(
      params.id,
      new Date(newExpiryDate),
      paymentAmount,
      paymentMethod
    );

    return NextResponse.json(updatedMember);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}