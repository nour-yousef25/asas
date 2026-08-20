export interface SmsInput {
  to: string;
  message: string;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  message: string;
}

/**
 * Sends an SMS message via a generic provider.
 * This is a mock implementation. In a real scenario, this would
 * interact with a specific SMS gateway API (e.g., 4jawaly, Unifonic).
 * @param input The SMS details.
 * @returns A promise that resolves with the sending result.
 */
export async function sendSms(input: SmsInput): Promise<SmsResult> {
  console.log(`Sending SMS to ${input.to}: "${input.message}"`);

  // Simulate API call to SMS gateway
  await new Promise(resolve => setTimeout(resolve, 500));

  const isSuccess = Math.random() > 0.05; // 95% success rate for simulation

  if (isSuccess) {
    const messageId = `sms_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    console.log(`SMS sent successfully. Message ID: ${messageId}`);
    return {
      success: true,
      messageId: messageId,
      message: "تم إرسال الرسالة بنجاح.",
    };
  } else {
    console.error(`Failed to send SMS to ${input.to}`);
    return {
      success: false,
      message: "فشلت عملية إرسال الرسالة.",
    };
  }
}