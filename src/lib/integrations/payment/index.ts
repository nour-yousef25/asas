// محاكاة بوابة الدفع (يجب استبدالها بالتكامل الحقيقي مع م stanie/Apple Pay/STC Pay)
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
  // محاكاة: يتم الموافقة على الدفع دائماً في وضع التطوير
  return { success: true, reference, message: "تمت معالجة الدفع بنجاح" };
}

export const PAYMENT_METHODS = [
  { value: "mada", label: "مدى" },
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "applepay", label: "Apple Pay" },
  { value: "stcpay", label: "STC Pay" },
  { value: "bank_transfer", label: "تحويل بنكي" },
];
