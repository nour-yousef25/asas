import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { donationSchema } from "@/lib/validations";
import { auth } from "@/lib/auth";
import { generateInvoiceNumber, generateRandomNumber } from "@/lib/utils";
import { processPayment } from "@/lib/integrations/payment";
import { parsePaginationParams, buildSearchCondition, paginatedQuery } from "@/lib/pagination";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const params = parsePaginationParams(searchParams);
  const status = searchParams.get("status");

  const searchFields = ["guestName", "guestPhone", "guestEmail", "paymentMethod"];
  const searchCondition = buildSearchCondition(params.search, searchFields);

  const where: any = {
    ...searchCondition,
  };
  if (status) where.status = status;

  const result = await paginatedQuery(
    (args) =>
      prisma.donation.findMany({
        ...args,
        include: {
          donor: { select: { id: true, name: true, phone: true } },
          project: { select: { title: true } },
          campaign: { select: { title: true } },
          invoice: true,
        },
      }),
    (args) => prisma.donation.count(args),
    where,
    params,
    "createdAt"
  );

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = donationSchema.parse(body);

    const paymentResult = await processPayment({
      amount: validated.amount,
      method: validated.paymentMethod,
      reference: `PAY-${Date.now()}-${generateRandomNumber(6)}`,
    });

    if (!paymentResult.success) {
      return NextResponse.json({ error: "فشل عملية الدفع" }, { status: 400 });
    }

    const donation = await prisma.donation.create({
      data: {
        amount: validated.amount,
        paymentMethod: validated.paymentMethod,
        paymentRef: paymentResult.reference,
        status: "COMPLETED",
        isAnonymous: validated.isAnonymous,
        isGuest: validated.isGuest,
        guestName: validated.guestName,
        guestPhone: validated.guestPhone,
        guestEmail: validated.guestEmail,
        donorId: validated.donorId,
        campaignId: validated.campaignId,
        projectId: validated.projectId,
      },
    });

    const taxNumber = process.env.ORG_TAX_NUMBER || "300000000000003";
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNo: generateInvoiceNumber(),
        donationId: donation.id,
        amount: validated.amount,
        taxAmount: 0,
        totalAmount: validated.amount,
        taxNumber,
        buyerName: validated.guestName || validated.donorId,
        buyerPhone: validated.guestPhone,
        buyerEmail: validated.guestEmail,
        status: "PAID",
      },
    });

    if (validated.projectId) {
      const project = await prisma.project.findUnique({ where: { id: validated.projectId } });
      if (project) {
        const newCollected = project.collectedAmount + validated.amount;
        const completion =
          project.targetAmount > 0
            ? Math.min(100, Math.round((newCollected / project.targetAmount) * 100))
            : 0;
        await prisma.project.update({
          where: { id: validated.projectId },
          data: { collectedAmount: newCollected, completionPercent: completion },
        });
      }
    }
    if (validated.campaignId) {
      await prisma.donationCampaign.update({
        where: { id: validated.campaignId },
        data: { collectedAmount: { increment: validated.amount } },
      });
    }

    if (validated.donorId) {
      await prisma.donor.update({
        where: { id: validated.donorId },
        data: {
          totalDonations: { increment: validated.amount },
          lastDonationAt: new Date(),
        },
      });
    }

    return NextResponse.json({ donation, invoice, success: true }, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Donation error:", error);
    return NextResponse.json({ error: "خطأ في معالجة التبرع" }, { status: 500 });
  }
}
