/**
 * وحدة التكامل مع بوابات الدفع.
 */
import axios from "axios";

interface PaymentRequest {
  amount: number;
  currency: string;
  description: string;
  callbackUrl: string;
}

interface PaymentResponse {
  paymentUrl: string;
  paymentId: string;
}

/**
 * إنشاء طلب دفع مع بوابة الدفع (كمثال: Moyasar أو PayTabs).
 */
export async function createPayment(request: PaymentRequest): Promise<PaymentResponse> {
  try {
    const response = await axios.post("https://api.example-payment.com/payments", request, {
      headers: {
        Authorization: `Bearer ${process.env.PAYMENT_API_KEY}`,
      },
    });

    return {
      paymentUrl: response.data.url,
      paymentId: response.data.id,
    };
  } catch (error: any) {
    console.error("Error creating payment:", error);
    throw new Error("Failed to create payment request");
  }
}

/**
 * تحقق من حالة الدفع بناءً على معرف الطلب.
 */
export async function checkPaymentStatus(paymentId: string) {
  try {
    const response = await axios.get(`https://api.example-payment.com/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYMENT_API_KEY}`,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error("Error checking payment status:", error);
    throw new Error("Failed to check payment status");
  }
}