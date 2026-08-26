"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = React.useState("");
  const [status, setStatus] = React.useState<string>();
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => { const raw = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token") ?? ""; setToken(raw); history.replaceState(null, "", "/reset-password"); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true);
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    const passwordConfirmation = String(new FormData(event.currentTarget).get("passwordConfirmation") ?? "");
    if (password !== passwordConfirmation) {
      setStatus("كلمتا المرور غير متطابقتين.");
      setLoading(false);
      return;
    }
    const response = await fetch("/api/password-recovery/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password }) });
    const body = await response.json().catch(() => ({}));
    if (response.ok) { setStatus("تم تغيير كلمة المرور. انتقل إلى تسجيل الدخول."); setTimeout(() => router.push("/login"), 800); } else setStatus(body.error ?? "تعذر إتمام الاستعادة.");
    setLoading(false);
  }
  return <main className="flex min-h-screen items-center justify-center p-4" dir="rtl"><form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-lg border bg-card p-6 shadow-sm"><div><h1 className="text-xl font-bold">تعيين كلمة مرور جديدة</h1><p className="mt-1 text-sm text-muted-foreground">12 حرفاً على الأقل، وتتضمن حرفاً كبيراً وصغيراً ورقماً.</p></div><div className="space-y-2"><Label htmlFor="password">كلمة المرور الجديدة</Label><Input id="password" name="password" type="password" minLength={12} required autoComplete="new-password" /></div><div className="space-y-2"><Label htmlFor="passwordConfirmation">تأكيد كلمة المرور الجديدة</Label><Input id="passwordConfirmation" name="passwordConfirmation" type="password" minLength={12} required autoComplete="new-password" /></div><Button className="w-full" disabled={loading || !token}>{loading ? "جارٍ الحفظ..." : "إعادة ضبط كلمة المرور"}</Button>{status && <p className="text-sm text-muted-foreground" role="status">{status}</p>}{!token && <p className="text-sm text-destructive">رابط الاستعادة غير صالح أو انتهت صلاحيته.</p>}</form></main>;
}
