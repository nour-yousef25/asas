import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { SessionProvider } from "next-auth/react";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "منصة أساس | إدارة الجمعيات الخيرية",
  description: "منصة متكاملة لإدارة الجمعيات الخيرية والمنظمات غير الربحية في المملكة العربية السعودية",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
