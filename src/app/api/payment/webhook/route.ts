import { NextRequest, NextResponse } from "next/server";

/**
 * واجهة Webhook لتلقي تحديثات الدفع من بوابة الدفع.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // تحقق من صحة الطلب (مثال: التوقيع أو الـ secret key)
    const signature = request.headers.get("X-Signature");
    if (!verifySignature(payload, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // معالجة التحديث (مثال: تحديث حالة الدفع في قاعدة البيانات)
    console.log("Received payment update:", payload);

    // الرد بنجاح
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error handling payment webhook:", error);
    return NextResponse.json(
      { error: "Failed to process payment webhook" },
      { status: 500 }
    );
  }
}

/**
 * دالة للتحقق من توقيع الطلب (لأغراض أمنية).
 */
function verifySignature(payload: any, signature: string | null): boolean {
  if (!signature || !process.env.PAYMENT_SECRET) return false;
  // مثال: مقارنة التوقيع مع الـ secret key
  const expectedSignature = generateExpectedSignature(payload, process.env.PAYMENT_SECRET);
  return signature === expectedSignature;
}

/**
 * مثال لتوليد التوقيع المتوقع.
 */
function generateExpectedSignature(payload: any, secret: string): string {
  const crypto = require("crypto");
  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");
}