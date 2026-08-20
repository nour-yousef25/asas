import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "منصة أساس | إدارة الجمعيات الخيرية",
  description: "منصة متكاملة لإدارة الجمعيات الخيرية والمنظمات غير الربحية في المملكة العربية السعودية",
};

// الصفحة الرئيسية تقوم بالتوجيه إلى لوحة التحكم
export const dynamic = "force-static";
export const revalidate = 0;

export async function GET() {
  redirect("/(dashboard)");
}