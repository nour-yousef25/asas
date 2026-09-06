import { NextRequest } from "next/server";
import { announcementSchema } from "@/lib/validations";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { apiSuccess, apiUnauthorized, apiError, apiInternalError } from "@/lib/api-response";
import { queryTenantApi, isTenantApiError } from "@/lib/tenant-query";

const log = logger.child("announcements");

export async function GET() {
  try {
    const items = await queryTenantApi((db) =>
      db.announcement.findMany({
        orderBy: { sortOrder: "asc" },
      }),
    );
    if (isTenantApiError(items)) return items;
    return apiSuccess(items);
  } catch (error) {
    log.error("Failed to fetch announcements", error);
    return apiInternalError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiUnauthorized();

    const body = await req.json();
    const validated = announcementSchema.parse(body);
    const item = await queryTenantApi((db) =>
      db.announcement.create({ data: validated }),
    );
    if (isTenantApiError(item)) return item;

    log.info("Announcement created", { id: item.id, title: item.title });
    return apiSuccess(item, 201);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return apiError("بيانات غير صحيحة", 400);
    }
    log.error("Failed to create announcement", error);
    return apiInternalError();
  }
}
