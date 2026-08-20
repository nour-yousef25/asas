/**
 * وحدة التكامل مع خدمات الرسائل القصيرة (SMS).
 */
import axios from "axios";

interface SmsRequest {
  to: string; // رقم الهاتف المستهدف
  message: string; // محتوى الرسالة
}

/**
 * إرسال رسالة نصية باستخدام خدمة SMS مثل Unifonic أو Twilio.
 */
export async function sendSms(request: SmsRequest): Promise<boolean> {
  try {
    const response = await axios.post("https://api.example-sms.com/send", request, {
      headers: {
        Authorization: `Bearer ${process.env.SMS_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    return response.data.success || false;
  } catch (error: any) {
    console.error("Error sending SMS:", error);
    throw new Error("Failed to send SMS");
  }
}