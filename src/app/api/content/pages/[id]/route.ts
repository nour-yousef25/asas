import { NextResponse } from "next/server";
import { getPageById, updatePage, deletePage } from "@/modules/content/pages";
import { queryTenantApi, isTenantApiError } from "@/lib/tenant-query";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const page = await queryTenantApi((db) => getPageById(db, id));
    if (isTenantApiError(page)) return page;

    if (!page) {
      return new NextResponse("Page not found", { status: 404 });
    }

    return NextResponse.json(page, { status: 200 });
  } catch (error) {
    console.error("[CONTENT_PAGE_ID_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, slug, content, category, isPublished } = body;

    const page = await queryTenantApi((db) =>
      updatePage(db, id, { title, slug, content, category, isPublished }),
    );
    if (isTenantApiError(page)) return page;

    if (!page) {
      return new NextResponse("Page not found", { status: 404 });
    }

    return NextResponse.json(page, { status: 200 });
  } catch (error) {
    console.error("[CONTENT_PAGE_ID_PUT]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const page = await queryTenantApi((db) => deletePage(db, id));
    if (isTenantApiError(page)) return page;

    if (!page) {
      return new NextResponse("Page not found", { status: 404 });
    }

    return new NextResponse("Page deleted", { status: 200 });
  } catch (error) {
    console.error("[CONTENT_PAGE_ID_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
