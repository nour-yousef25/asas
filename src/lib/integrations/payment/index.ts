// الدفع لا يملك implementation افتراضياً؛ أي gateway يجب تركيبها خارجياً بعد contract وwebhook ledger موثوقين.
interface ProcessPaymentArgs {
  amount: number;
  method: string;
  reference: string;
}

interface PaymentResult {
  success: boolean;
  reference: string;
  message?: string;
}

export async function processPayment(args: ProcessPaymentArgs): Promise<PaymentResult> {
  const { amount, method, reference } = args;
  if (amount <= 0) {
    return { success: false, reference, message: "المبلغ غير صالح" };
  }
  const validMethods = ["mada", "visa", "mastercard", "applepay", "stcpay", "bank_transfer"];
  if (!validMethods.includes(method)) {
    return { success: false, reference, message: "طريقة دفع غير مدعومة" };
  }
  return { success: false, reference, message: "بوابة الدفع محجوبة حتى تركيب مسار tenant-bound وledger reconciliation معتمدين" };
}

export const PAYMENT_METHODS = [
  { value: "mada", label: "مدى" },
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "applepay", label: "Apple Pay" },
  { value: "stcpay", label: "STC Pay" },
  { value: "bank_transfer", label: "تحويل بنكي" },
];
