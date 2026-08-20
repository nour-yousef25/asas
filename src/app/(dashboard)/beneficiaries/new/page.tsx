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

export default function NewBeneficiaryPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const body = Object.fromEntries(formData.entries());
    try {
      const res = await fetch("/api/beneficiaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      addToast({ type: "success", title: "تمت الإضافة", description: "تم تسجيل المستفيد بنجاح" });
      router.push("/beneficiaries");
      router.refresh();
    } catch {
      addToast({ type: "error", title: "خطأ", description: "تعذرت الإضافة" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="إضافة مستفيد جديد" description="إدخال بيانات مستفيد جديد لقاعدة بيانات الجمعية" />
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2"><Label htmlFor="name">الاسم *</Label><Input id="name" name="name" required /></div>
            <div className="space-y-2"><Label htmlFor="nationalId">رقم الهوية</Label><Input id="nationalId" name="nationalId" /></div>
            <div className="space-y-2"><Label htmlFor="phone">رقم الجوال *</Label><Input id="phone" name="phone" required placeholder="05XXXXXXXX" /></div>
            <div className="space-y-2"><Label htmlFor="email">البريد الإلكتروني</Label><Input id="email" name="email" type="email" /></div>
            <div className="space-y-2"><Label htmlFor="gender">الجنس</Label>
              <Select name="gender" options={[{ value: "MALE", label: "ذكر" }, { value: "FEMALE", label: "أنثى" }]} /></div>
            <div className="space-y-2"><Label htmlFor="dateOfBirth">تاريخ الميلاد</Label><Input id="dateOfBirth" name="dateOfBirth" type="date" /></div>
            <div className="space-y-2"><Label htmlFor="city">المدينة</Label><Input id="city" name="city" /></div>
            <div className="space-y-2"><Label htmlFor="address">العنوان</Label><Input id="address" name="address" /></div>
            <div className="space-y-2"><Label htmlFor="familyMembers">عدد أفراد الأسرة</Label><Input id="familyMembers" name="familyMembers" type="number" min="0" /></div>
            <div className="space-y-2"><Label htmlFor="needCategory">فئة الاحتياج</Label>
              <Input id="needCategory" name="needCategory" placeholder="مثال: كفالة أيتام، مساعدة مالية، رعاية صحية" /></div>
            <div className="space-y-2"><Label htmlFor="incomeLevel">مستوى الدخل</Label><Input id="incomeLevel" name="incomeLevel" /></div>
          </div>
          <div className="space-y-2 md:col-span-2"><Label htmlFor="notes">ملاحظات</Label><textarea id="notes" name="notes" className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>إلغاء</Button>
            <Button type="submit" disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
