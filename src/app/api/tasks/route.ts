import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { taskSchema } from "@/lib/validations";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const tasks = await prisma.task.findMany({
    include: {
      creator: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      comments: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();
  const validated = taskSchema.parse(body);
  const task = await prisma.task.create({
    data: {
      title: validated.title,
      description: validated.description,
      status: validated.status,
      priority: validated.priority,
      dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
      assigneeId: validated.assigneeId,
      creatorId: session.user.id,
      department: validated.department,
      tags: validated.tags,
    },
  });
  return NextResponse.json(task, { status: 201 });
}
