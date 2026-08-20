"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/data-table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

export default function NewProjectPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const body = Object.fromEntries(formData.entries());

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      addToast({ type: "success", title: "تمت الإضافة", description: "تم إنشاء المشروع بنجاح" });
      router.push("/projects");
      router.refresh();
    } catch {
      addToast({ type: "error", title: "خطأ", description: "تعذر إنشاء المشروع" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="إضافة مشروع جديد" description="أنشئ مشروع تبرع جديد مع تحديد القيمة المطلوبة" />
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">عنوان المشروع *</Label>
            <Input id="title" name="title" required placeholder="عنوان المشروع" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">الوصف</Label>
            <Textarea id="description" name="description" rows={4} placeholder="وصف المشروع" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="targetAmount">القيمة المطلوبة (ريال) *</Label>
              <Input id="targetAmount" name="targetAmount" type="number" min="0" step="0.01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">التصنيف</Label>
              <Input id="category" name="category" placeholder="كفالة، إغاثة، تعليم..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">تاريخ البداية *</Label>
              <Input id="startDate" name="startDate" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">تاريخ النهاية</Label>
              <Input id="endDate" name="endDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">الموقع</Label>
              <Input id="location" name="location" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">الحالة</Label>
              <Select
                name="status"
                defaultValue="PLANNING"
                options={[
                  { value: "PLANNING", label: "قيد التخطيط" },
                  { value: "ACTIVE", label: "نشط" },
                  { value: "COMPLETED", label: "مكتمل" },
                  { value: "SUSPENDED", label: "متوقف" },
                  { value: "CANCELLED", label: "ملغى" },
                ]}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="imageUrl">رابط الصورة</Label>
            <Input id="imageUrl" name="imageUrl" type="url" placeholder="https://..." />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>إلغاء</Button>
            <Button type="submit" disabled={loading}>{loading ? "جارٍ الحفظ..." : "إنشاء المشروع"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
