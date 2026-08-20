import { NextResponse } from 'next/server';
import { createPage, getAllPages } from '@/modules/content/pages';

export async function GET() {
  try {
    const pages = await getAllPages();
    return NextResponse.json(pages);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const newPage = await createPage(data);
    return NextResponse.json(newPage, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
