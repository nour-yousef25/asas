/** Provider-neutral payment contract; no placeholder URL, API key, or default provider exists. */
export { PaymentGatewayError, PaymentGatewayService, installPaymentProvider, requirePaymentProvider, type PaymentIntent, type PaymentLedger, type PaymentProvider, type VerifiedPaymentEvent } from "@/lib/payment-gateway";
