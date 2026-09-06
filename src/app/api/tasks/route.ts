import { NextRequest, NextResponse } from "next/server";
import { taskSchema } from "@/lib/validations";
import { queryTenantApi, isTenantApiError } from "@/lib/tenant-query";

export async function GET() {
  const tasks = await queryTenantApi((db, context) =>
    db.task.findMany({
      where: { organizationId: context.organizationId },
      include: {
        creator: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
        comments: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
  );
  if (isTenantApiError(tasks)) return tasks;
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const validated = taskSchema.parse(body);
  const task = await queryTenantApi((db, context) =>
    db.task.create({
      data: {
        title: validated.title,
        description: validated.description,
        status: validated.status,
        priority: validated.priority,
        dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
        assigneeId: validated.assigneeId,
        creatorId: context.userId,
        organizationId: context.organizationId,
        department: validated.department,
        tags: validated.tags,
      },
    }),
  );
  if (isTenantApiError(task)) return task;
  return NextResponse.json(task, { status: 201 });
}
