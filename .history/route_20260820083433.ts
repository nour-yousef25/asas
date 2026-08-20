import { NextResponse } from 'next/server';
import { createExpense, getAllExpenses } from '@/modules/finance/expenses';

export async function GET() {
  try {
    const expenses = await getAllExpenses();
    return NextResponse.json(expenses);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const newExpense = await createExpense(data);
    return NextResponse.json(newExpense, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}