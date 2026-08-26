"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [status, setStatus] = React.useState<string>();
  const [loading, setLoading] = React.useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true);
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    const response = await fetch("/api/password-recovery/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const body = await response.json().catch(() => ({ message: "إذا كان الحساب موجوداً، فستصلك تعليمات الاستعادة." }));
    setStatus(body.message ?? "إذا كان الحساب موجوداً، فستصلك تعليمات الاستعادة."); setLoading(false);
  }
  return <main className="flex min-h-screen items-center justify-center p-4" dir="rtl"><form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-lg border bg-card p-6 shadow-sm"><div><h1 className="text-xl font-bold">استعادة كلمة المرور</h1><p className="mt-1 text-sm text-muted-foreground">أدخل بريدك الإلكتروني وسنرسل تعليمات الاستعادة إذا كان الحساب موجوداً.</p></div><div className="space-y-2"><Label htmlFor="email">البريد الإلكتروني</Label><Input id="email" name="email" type="email" required autoComplete="email" /></div><Button className="w-full" disabled={loading}>{loading ? "جارٍ الإرسال..." : "إرسال تعليمات الاستعادة"}</Button>{status && <p className="text-sm text-muted-foreground" role="status">{status}</p>}<a className="block text-center text-sm text-primary hover:underline" href="/login">العودة إلى تسجيل الدخول</a></form></main>;
}
