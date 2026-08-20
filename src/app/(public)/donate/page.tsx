"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/data-table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/integrations/payment";

type Project = { id: string; title: string; description: string | null; imageUrl: string | null; targetAmount: number; collectedAmount: number; completionPercent: number };
type Campaign = { id: string; title: string; description: string | null; targetAmount: number; collectedAmount: number };

export default function DonatePage() {
  const { addToast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [target, setTarget] = React.useState<string>("general");

  React.useEffect(() => {
    fetch("/api/projects?status=ACTIVE").then((r) => r.json()).then(setProjects);
    fetch("/api/campaigns?status=ACTIVE").then((r) => r.json()).then(setCampaigns);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const body: any = {
      amount: parseFloat(formData.get("amount") as string),
      paymentMethod: formData.get("paymentMethod"),
      isGuest: true,
      guestName: formData.get("guestName"),
      guestPhone: formData.get("guestPhone"),
      guestEmail: formData.get("guestEmail") || "",
      isAnonymous: formData.get("isAnonymous") === "on",
    };
    if (target.startsWith("project:")) body.projectId = target.split(":")[1];
    else if (target.startsWith("campaign:")) body.campaignId = target.split(":")[1];

    try {
      const res = await fetch("/api/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      addToast({
        type: "success",
        title: "تم التبرع بنجاح",
        description: `شكراً لك! رقم الفاتورة: ${data.invoice.invoiceNo}`,
      });
      // إعادة توجيه إلى الفاتورة
      window.location.href = `/donations/invoices/${data.donation.id}`;
    } catch {
      addToast({ type: "error", title: "خطأ", description: "تعذرت عملية التبرع" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 p-4" dir="rtl">
      <div className="max-w-3xl mx-auto pt-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold">تبرع الآن</h1>
          <p className="text-muted-foreground mt-2">ساهم في مساعدة المحتاجين - تبرع في 10 ثوانٍ دون تسجيل دخول</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label className="mb-2 block">اختر الجهة</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setTarget("general")}
                  className={`rounded-lg border p-3 text-sm transition-colors ${target === "general" ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
                >تبرع عام</button>
                {projects.slice(0, 3).map((p) => (
                  <button key={p.id} type="button" onClick={() => setTarget(`project:${p.id}`)}
                    className={`rounded-lg border p-3 text-sm text-right transition-colors ${target === `project:${p.id}` ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
                  >{p.title}</button>
                ))}
                {campaigns.slice(0, 3).map((c) => (
                  <button key={c.id} type="button" onClick={() => setTarget(`campaign:${c.id}`)}
                    className={`rounded-lg border p-3 text-sm text-right transition-colors ${target === `campaign:${c.id}` ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
                  >{c.title}</button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">مبلغ التبرع (ريال) *</Label>
              <div className="flex flex-wrap gap-2">
                {[50, 100, 200, 500, 1000].map((a) => (
                  <Button key={a} type="button" variant="outline" size="sm" onClick={() => {
                    document.getElementById("amount") as HTMLInputElement;
                  }}>{a} ر.س</Button>
                ))}
              </div>
              <Input id="amount" name="amount" type="number" min="1" step="0.01" required placeholder="أو أدخل مبلغاً مخصصاً" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="guestName">الاسم *</Label><Input id="guestName" name="guestName" required /></div>
              <div className="space-y-2"><Label htmlFor="guestPhone">رقم الجوال *</Label><Input id="guestPhone" name="guestPhone" required placeholder="05XXXXXXXX" /></div>
              <div className="space-y-2"><Label htmlFor="guestEmail">البريد الإلكتروني (اختياري)</Label><Input id="guestEmail" name="guestEmail" type="email" /></div>
              <div className="space-y-2"><Label htmlFor="paymentMethod">طريقة الدفع</Label>
                <Select name="paymentMethod" options={PAYMENT_METHODS} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isAnonymous" /> تبرع مجهول (عدم إظهار اسمي)
            </label>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "جارٍ المعالجة..." : `تبرع الآن`}
            </Button>
          </form>
        </Card>

        {/* عرض المشاريع مع التقدم */}
        {projects.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">المشاريع النشطة</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {projects.map((p) => (
                <Card key={p.id} className="p-4">
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{formatCurrency(p.collectedAmount)} من {formatCurrency(p.targetAmount)}</span>
                      <Badge variant="default">٪{p.completionPercent}</Badge>
                    </div>
                    <ProgressBar value={p.completionPercent} showLabel={false} />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
