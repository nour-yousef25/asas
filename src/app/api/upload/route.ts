import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadFile, STORAGE_PATHS } from "@/lib/storage";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const category = formData.get("category") as string || "temporary";

    if (!file) {
      return NextResponse.json({ error: "ملف مطلوب" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "حجم الملف يتجاوز الحد الأقصى (10MB)" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "نوع الملف غير مدعوم" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const ext = file.name.split(".").pop() || "bin";
    const timestamp = Date.now();
    const safeFilename = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    let path: string;
    switch (category) {
      case "documents":
        path = STORAGE_PATHS.documents(session.user.id, safeFilename);
        break;
      case "avatars":
        path = STORAGE_PATHS.avatars(session.user.id, ext);
        break;
      case "news":
        path = STORAGE_PATHS.news(session.user.id, safeFilename);
        break;
      case "projects":
        path = STORAGE_PATHS.projects(session.user.id, safeFilename);
        break;
      case "gallery":
        path = STORAGE_PATHS.gallery(session.user.id, safeFilename);
        break;
      default:
        path = STORAGE_PATHS.temporary(safeFilename);
    }

    const result = await uploadFile(path, buffer, file.type);

    return NextResponse.json({
      success: true,
      url: result.url,
      path: result.path,
      filename: file.name,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "خطأ في رفع الملف" }, { status: 500 });
  }
}
