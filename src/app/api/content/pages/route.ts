import { NextResponse } from 'next/server';
import { createPage, getAllPages } from '@/modules/content/pages';
import { queryTenantApi, isTenantApiError } from '@/lib/tenant-query';

export async function GET() {
  try {
    const pages = await queryTenantApi((db) => getAllPages(db));
    if (isTenantApiError(pages)) return pages;
    return NextResponse.json(pages);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const newPage = await queryTenantApi((db) => createPage(db, data));
    if (isTenantApiError(newPage)) return newPage;
    return NextResponse.json(newPage, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
