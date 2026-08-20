import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// إنشاء slug من نص عربي
export function slugify(text: string): string {
  return text
    .toString()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\u0600-\u06FFa-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-");
}

// توليد رقم عشوائي آمن
export function generateRandomNumber(length: number): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0].toString().slice(0, length).padStart(length, "0");
}

// توليد رقم فاتورة
export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const random = generateRandomNumber(8);
  return `INV-${year}-${random}`;
}

// تأخير
export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// التحقق من صحة رقم الجوال السعودي
export function isValidSaudiPhone(phone: string): boolean {
  const cleaned = phone.replace(/\s/g, "");
  return /^(?:\+966|0)?5\d{8}$/.test(cleaned);
}

// تنسيق رقم الجوال السعودي
export function formatSaudiPhone(phone: string): string {
  const cleaned = phone.replace(/\s/g, "").replace(/\+966/, "0");
  if (cleaned.startsWith("05") && cleaned.length === 10) {
    return `+966${cleaned.slice(1)}`;
  }
  return phone;
}

// التحقق من رقم الهوية الوطنية
export function isValidSaudiId(id: string): boolean {
  if (!/^\d{10}$/.test(id)) return false;
  if (!id.startsWith("1")) return false;
  return true;
}
