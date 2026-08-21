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

export default function EditNewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<any>(null);

  React.useEffect(() => {
    fetch(`/api/news/${id}`)
      .then((r) => r.json())
      .then(setData);
  }, [id]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const body = Object.fromEntries(formData.entries());
    try {
      const res = await fetch(`/api/news/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      addToast({ type: "success", title: "تم التحديث", description: "تم تحديث الخبر بنجاح" });
      router.push("/news");
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
      <PageHeader title="تعديل الخبر" description={`تعديل: ${data.title}`} />
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">عنوان الخبر *</Label>
            <Input id="title" name="title" defaultValue={data.title} required />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">التصنيف</Label>
              <Input id="category" name="category" defaultValue={data.category || ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">الحالة</Label>
              <Select
                name="status"
                defaultValue={data.status}
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
            <Input id="imageUrl" name="imageUrl" type="url" defaultValue={data.imageUrl || ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="summary">ملخص</Label>
            <Textarea id="summary" name="summary" rows={2} defaultValue={data.summary || ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">المحتوى *</Label>
            <Textarea id="content" name="content" rows={10} defaultValue={data.content} required />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "جارٍ الحفظ..." : "حفظ التعديلات"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
