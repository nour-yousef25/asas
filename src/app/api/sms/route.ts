import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { smsQueue } from "@/lib/queue";

const smsSendSchema = z.object({
  phones: z.array(z.string()).min(1, "رقم واحد على الأقل"),
  message: z.string().optional(),
  templateId: z.string().optional(),
  phrases: z.record(z.string()).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const templates = await prisma.smsTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();
  const validated = smsSendSchema.parse(body);

  let message = validated.message || "";
  if (validated.templateId) {
    const template = await prisma.smsTemplate.findUnique({ where: { id: validated.templateId } });
    if (template) {
      message = template.content.replace(/{{([^}]+)}}/g, (_, key) => validated.phrases?.[key] ?? `{{${key}}}`);
    }
  }

  if (!message) return NextResponse.json({ error: "الرسالة مطلوبة" }, { status: 400 });

  try {
    const job = await smsQueue.add("send-sms", {
      phones: validated.phones,
      templateId: validated.templateId,
      phrases: validated.phrases || {},
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      phones: validated.phones,
      succeeded: validated.phones.length,
      message: "تم إضافة الرسائل إلى قائمة الإرسال",
    });
  } catch (error) {
    console.error("SMS queue error:", error);
    return NextResponse.json({ error: "خطأ في إضافة الرسائل" }, { status: 500 });
  }
}
