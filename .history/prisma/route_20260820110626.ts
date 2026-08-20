import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { PrismaClient, DonationStatus } from '@prisma/client';

const prisma = new PrismaClient();

// في بيئة الإنتاج، يجب أن يكون هذا المتغير سرياً ومخزناً في متغيرات البيئة
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || 'a-very-secure-secret-for-dev';

/**
 * دالة وهمية للتحقق من توقيع الـ webhook.
 * في الواقع، ستستخدم مكتبة crypto لإنشاء HMAC hash للمحتوى ومقارنته بالتوقيع.
 */
async function verifySignature(payload: string, signature: string): Promise<boolean> {
  // للتبسيط، سنتحقق فقط من تطابق التوقيع مع السر.
  // const expectedSignature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
  // return signature === expectedSignature;
  return signature === WEBHOOK_SECRET;
}

export async function POST(request: Request) {
  const headersList = headers();
  const signature = headersList.get('x-payment-signature');
  const body = await request.text(); // نقرأ المحتوى كنص للتحقق من التوقيع

  // 1. التحقق من التوقيع للأمان
  if (!signature || !(await verifySignature(body, signature))) {
    console.warn('Webhook signature validation failed.');
    return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
  }

  try {
    const event = JSON.parse(body);
    const { transactionId, status } = event.data; // افتراض بنية محتوى الـ webhook

    if (!transactionId || !status) {
      return NextResponse.json({ message: 'Payload is missing transactionId or status' }, { status: 400 });
    }

    // 2. البحث عن التبرع المرتبط بالمعاملة
    const donation = await prisma.donation.findFirst({
      where: { paymentRef: transactionId },
    });

    if (donation) {
      // 3. تحديث حالة التبرع في قاعدة البيانات
      const newStatus = status === 'paid' ? DonationStatus.COMPLETED : DonationStatus.FAILED;
      await prisma.donation.update({
        where: { id: donation.id },
        data: { status: newStatus },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    return NextResponse.json({ message: `Webhook Error: ${error.message}` }, { status: 400 });
  }
}