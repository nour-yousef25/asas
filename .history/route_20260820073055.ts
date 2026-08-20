import { NextResponse } from 'next/server';
import {
  updatePage,
  getPageById,
  deletePage,
} from '@/modules/content/pages';

type RouteParams = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const page = await getPageById(params.id);
    if (!page) {
      return NextResponse.json({ message: 'Page not found' }, { status: 404 });
    }
    return NextResponse.json(page);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const data = await request.json();
    const updatedPage = await updatePage(params.id, data);
    return NextResponse.json(updatedPage);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    await deletePage(params.id);
    return NextResponse.json({ message: 'Page deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}