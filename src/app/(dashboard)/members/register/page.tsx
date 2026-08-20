"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/data-table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { isValidSaudiPhone } from "@/lib/utils";

export default function RegisterMemberPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const phone = formData.get("phone") as string;
    if (!isValidSaudiPhone(phone)) {
      addToast({ type: "error", title: "خطأ", description: "رقم الجوال غير صحيح" });
      setLoading(false);
      return;
    }

    try {
      // إنشاء المستخدم ثم العضوية
      const userRes = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          phone,
          role: "MEMBER",
        }),
      });
      const user = await userRes.json();

      await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          membershipType: formData.get("membershipType"),
          membershipFee: parseFloat(formData.get("membershipFee") as string) || 0,
          paidAmount: parseFloat(formData.get("paidAmount") as string) || 0,
          status: "ACTIVE",
          paymentStatus: parseFloat(formData.get("paidAmount") as string) >= parseFloat(formData.get("membershipFee") as string) ? "PAID" : "PENDING",
        }),
      });
      addToast({ type: "success", title: "تم التسجيل", description: "تم تسجيل العضو بنجاح" });
      router.push("/members");
      router.refresh();
    } catch {
      addToast({ type: "error", title: "خطأ", description: "تعذر تسجيل العضو" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="تسجيل عضو جديد" description="إضافة عضو جديد إلى قاعدة بيانات الجمعية" />
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="name">الاسم *</Label><Input id="name" name="name" required /></div>
            <div className="space-y-2"><Label htmlFor="phone">رقم الجوال *</Label><Input id="phone" name="phone" required placeholder="05XXXXXXXX" /></div>
            <div className="space-y-2"><Label htmlFor="email">البريد الإلكتروني</Label><Input id="email" name="email" type="email" /></div>
            <div className="space-y-2"><Label htmlFor="membershipType">نوع العضوية</Label>
              <Select name="membershipType" options={[
                { value: "REGULAR", label: "عضو فعّال (افتراضي)" },
                { value: "FOUNDER", label: "عضو مؤسس" },
                { value: "HONORARY", label: "عضو فخري" },
                { value: "ASSOCIATE", label: "عضو منتسب" },
              ]} />
            </div>
            <div className="space-y-2"><Label htmlFor="membershipFee">رسوم العضوية (ريال)</Label><Input id="membershipFee" name="membershipFee" type="number" min="0" step="0.01" defaultValue="500" /></div>
            <div className="space-y-2"><Label htmlFor="paidAmount">المبلغ المدفوع (ريال)</Label><Input id="paidAmount" name="paidAmount" type="number" min="0" step="0.01" defaultValue="0" /></div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>إلغاء</Button>
            <Button type="submit" disabled={loading}>{loading ? "جارٍ التسجيل..." : "تسجيل العضو"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
