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

export default function EditProjectPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<any>(null);

  React.useEffect(() => {
    fetch(`/api/projects/${params.id}`).then((r) => r.json()).then((d) => {
      if (d.startDate) d.startDate = d.startDate.split("T")[0];
      if (d.endDate) d.endDate = d.endDate.split("T")[0];
      setData(d);
    });
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const body = Object.fromEntries(formData.entries());
    try {
      const res = await fetch(`/api/projects/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      addToast({ type: "success", title: "تم التحديث", description: "تم تحديث المشروع بنجاح" });
      router.push("/projects");
      router.refresh();
    } catch {
      addToast({ type: "error", title: "خطأ", description: "تعذرت عملية التحديث" });
    } finally {
      setLoading(false);
    }
  };

  if (!data) return <div className="p-4">جارٍ التحميل...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="تعديل المشروع" description={`تعديل: ${data.title}`} />
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="title">عنوان المشروع *</Label><Input id="title" name="title" defaultValue={data.title} required /></div>
          <div className="space-y-2"><Label htmlFor="description">الوصف</Label><Textarea id="description" name="description" rows={4} defaultValue={data.description || ""} /></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="targetAmount">القيمة المطلوبة</Label><Input id="targetAmount" name="targetAmount" type="number" min="0" step="0.01" defaultValue={data.targetAmount} required /></div>
            <div className="space-y-2"><Label htmlFor="collectedAmount">المبلغ المحصّل</Label><Input id="collectedAmount" name="collectedAmount" type="number" min="0" step="0.01" defaultValue={data.collectedAmount} /></div>
            <div className="space-y-2"><Label htmlFor="startDate">تاريخ البداية</Label><Input id="startDate" name="startDate" type="date" defaultValue={data.startDate} required /></div>
            <div className="space-y-2"><Label htmlFor="endDate">تاريخ النهاية</Label><Input id="endDate" name="endDate" type="date" defaultValue={data.endDate || ""} /></div>
            <div className="space-y-2"><Label htmlFor="status">الحالة</Label>
              <Select name="status" defaultValue={data.status} options={[
                { value: "PLANNING", label: "قيد التخطيط" }, { value: "ACTIVE", label: "نشط" },
                { value: "COMPLETED", label: "مكتمل" }, { value: "SUSPENDED", label: "متوقف" }, { value: "CANCELLED", label: "ملغى" }]} /></div>
            <div className="space-y-2"><Label htmlFor="category">التصنيف</Label><Input id="category" name="category" defaultValue={data.category || ""} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="imageUrl">رابط الصورة</Label><Input id="imageUrl" name="imageUrl" type="url" defaultValue={data.imageUrl || ""} /></div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>إلغاء</Button>
            <Button type="submit" disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ التعديلات"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
