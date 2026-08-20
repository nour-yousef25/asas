import type { Metadata } from "next";
import { redirect } from "next/navigation";

// الصفحة الرئيسية تقوم بالتوجيه إلى لوحة التحكم
export default function HomePage() {
  // التوجيه مباشرة إلى المسار الجذر للوحة التحكم
  // Next.js سيتعامل مع عرض المسار الصحيح لمجموعة (dashboard)
  redirect("/");
}

// يمكن إبقاء الـ metadata هنا أو نقلها إلى layout لوحة التحكم الرئيسي