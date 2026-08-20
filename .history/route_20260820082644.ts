import { NextResponse } from 'next/server';
import { getBudgetDetails, deleteBudget } from '@/modules/finance/budget';

type RouteParams = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const budget = await getBudgetDetails(params.id);
    if (!budget) {
      return NextResponse.json({ message: 'Budget not found' }, { status: 404 });
    }
    return NextResponse.json(budget);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    await deleteBudget(params.id);
    return NextResponse.json({ message: 'Budget deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}