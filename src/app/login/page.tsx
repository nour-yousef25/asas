"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/logo";
import { useToast } from "@/components/ui/toast";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const identifier = formData.get("identifier") as string;
    const password = formData.get("password") as string;

    const result = await signIn("credentials", {
      redirect: false,
      identifier,
      password,
    });

    if (result?.error) {
      addToast({
        type: "error",
        title: "فشل تسجيل الدخول",
        description: "البريد أو الجوال أو كلمة المرور غير صحيحة",
      });
    } else {
      addToast({ type: "success", title: "مرحباً بك", description: "تم تسجيل الدخول بنجاح" });
      const callbackUrl = searchParams.get("callbackUrl");
      router.push(callbackUrl?.startsWith("/") ? callbackUrl : "/");
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/10 p-4" dir="rtl">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary text-primary-foreground text-2xl font-bold">
            أ
          </div>
          <h1 className="text-2xl font-bold">منصة أساس</h1>
          <p className="text-sm text-muted-foreground">إدارة الجمعيات الخيرية في المملكة العربية السعودية</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="identifier">البريد الإلكتروني أو رقم الجوال</Label>
            <Input
              id="identifier"
              name="identifier"
              type="text"
              placeholder="example@asas.gov.sa"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">كلمة المرور</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "جارٍ التحقق..." : "تسجيل الدخول"}
          </Button>

          <div className="text-center text-sm">
            <a href="/forgot-password" className="text-primary hover:underline">نسيت كلمة المرور؟</a>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            ليس لديك حساب؟{" "}
            <a href="/login?tab=register" className="text-primary hover:underline">
              طلب تجربة النظام
            </a>
          </div>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          © ٢٠٢٦ منصة أساس - جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}
