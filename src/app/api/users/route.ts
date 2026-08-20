import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { userSchema } from "@/lib/validations";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role");
  const where: any = {};
  if (role) where.role = role;
  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, phone: true, role: true, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();
  // للمستخدمين المسجلين بدون كلمة مرور (تسجيل داخلي فقط)
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      role: body.role || "MEMBER",
    },
  });
  return NextResponse.json(user, { status: 201 });
}
