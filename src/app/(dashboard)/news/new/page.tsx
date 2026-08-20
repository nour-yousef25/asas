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

export default function NewNewsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const body = Object.fromEntries(formData.entries());

    try {
      const res = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      addToast({ type: "success", title: "تمت الإضافة", description: "تم إضافة الخبر بنجاح" });
      router.push("/news");
      router.refresh();
    } catch {
      addToast({ type: "error", title: "خطأ", description: "تعذرت إضافة الخبر" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="إضافة خبر جديد" description="أضف خبراً جديداً إلى موقع الجمعية" />
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">عنوان الخبر *</Label>
            <Input id="title" name="title" required placeholder="عنوان الخبر" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">التصنيف</Label>
              <Input id="category" name="category" placeholder="أخبار، أنشطة، إعلانات..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">الحالة</Label>
              <Select
                name="status"
                defaultValue="DRAFT"
                options={[
                  { value: "DRAFT", label: "مسودة" },
                  { value: "PUBLISHED", label: "منشور" },
                  { value: "ARCHIVED", label: "مؤرشف" },
                ]}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="imageUrl">رابط الصورة</Label>
            <Input id="imageUrl" name="imageUrl" type="url" placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="summary">ملخص</Label>
            <Textarea id="summary" name="summary" rows={2} placeholder="ملخص قصير عن الخبر" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">المحتوى *</Label>
            <Textarea id="content" name="content" rows={10} required placeholder="محتوى الخبر الكامل..." />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "جارٍ الحفظ..." : "حفظ الخبر"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
