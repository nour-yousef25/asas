import { NextResponse } from "next/server";
import { getPageById, updatePage, deletePage } from "@/modules/content/pages";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const page = await getPageById(params.id);

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
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { title, slug, content, category, isPublished } = body;

    const page = await updatePage(params.id, {
      title,
      slug,
      content,
      category,
      isPublished,
    });

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
  { params }: { params: { id: string } }
) {
  try {
    const page = await deletePage(params.id);

    if (!page) {
      return new NextResponse("Page not found", { status: 404 });
    }

    return new NextResponse("Page deleted", { status: 200 });
  } catch (error) {
    console.error("[CONTENT_PAGE_ID_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
