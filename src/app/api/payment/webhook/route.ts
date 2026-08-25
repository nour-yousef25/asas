import { NextRequest, NextResponse } from "next/server";
import { PaymentGatewayError, requirePaymentProvider } from "@/lib/payment-gateway";

/**
 * واجهة Webhook لتلقي تحديثات الدفع من بوابة الدفع.
 */
export async function POST(request: NextRequest) {
  try {
    // لا نقبل webhook حتى يتم تركيب provider verifier وtenant-bound idempotent ledger معاً.
    requirePaymentProvider();
    return NextResponse.json({ error: "PAYMENT_WEBHOOK_LEDGER_UNCONFIGURED" }, { status: 503 });
  } catch (error) {
    if (error instanceof PaymentGatewayError) return NextResponse.json({ error: "PAYMENT_PROVIDER_UNCONFIGURED" }, { status: 503 });
    return NextResponse.json(
      { error: "PAYMENT_WEBHOOK_REJECTED" },
      { status: 500 }
    );
  }
}
