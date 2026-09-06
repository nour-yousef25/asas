import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { queryTenantApi, isTenantApiError } from "@/lib/tenant-query";

const volunteerSchema = z.object({
  userId: z.string().min(1, "المستخدم مطلوب"),
  skills: z.array(z.string()).default([]),
  availability: z.string().default("flexible"),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).default("ACTIVE"),
});

export async function GET() {
  const volunteers = await queryTenantApi((db) =>
    db.volunteer.findMany({
      include: { user: { select: { id: true, name: true, phone: true, email: true } }, activities: true },
      orderBy: { createdAt: "desc" },
    }),
  );
  if (isTenantApiError(volunteers)) return volunteers;
  return NextResponse.json(volunteers);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const validated = volunteerSchema.parse(body);
  const volunteer = await queryTenantApi((db) =>
    db.volunteer.create({ data: validated }),
  );
  if (isTenantApiError(volunteer)) return volunteer;
  return NextResponse.json(volunteer, { status: 201 });
}
