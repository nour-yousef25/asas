"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/data-table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";

type Announcement = {
  id: string;
  title: string;
  content: string | null;
  startDate: Date;
  endDate: Date | null;
  isFeatured: boolean;
  isActive: boolean;
};

export default function AnnouncementsPage() {
  const { addToast } = useToast();
  const [items, setItems] = React.useState<Announcement[]>([]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Announcement | null>(null);

  const load = async () => {
    const res = await fetch("/api/announcements");
    const data = await res.json();
    setItems(data);
  };

  React.useEffect(() => { load(); }, []);

  const handleSave = async (formData: FormData) => {
    const body = Object.fromEntries(formData.entries());
    body.startDate = body.startDate || new Date().toISOString();
    body.isFeatured = formData.get("isFeatured") === "on";
    body.isActive = formData.get("isActive") === "on";
    try {
      const url = editing ? `/api/announcements/${editing.id}` : "/api/announcements";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      addToast({ type: "success", title: editing ? "تم التحديث" : "تمت الإضافة" });
      setModalOpen(false);
      setEditing(null);
      load();
    } catch {
      addToast({ type: "error", title: "خطأ", description: "تعذرت العملية" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    await fetch(`/api/announcements/${id}`, { method: "DELETE" });
    load();
    addToast({ type: "success", title: "تم الحذف" });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="الإعلانات"
        description="إدارة الإعلانات الخاصة بالجمعية"
        actions={<Button onClick={() => { setEditing(null); setModalOpen(true); }}>إضافة إعلان</Button>}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{a.title}</h3>
              <div className="flex gap-1">
                {a.isFeatured && <Badge variant="default">مميز</Badge>}
                <Badge variant={a.isActive ? "success" : "secondary"}>{a.isActive ? "نشط" : "موقوف"}</Badge>
              </div>
            </div>
            {a.content && <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{a.content}</p>}
            <p className="mt-2 text-xs text-muted-foreground">من {formatDate(a.startDate)}</p>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setEditing(a); setModalOpen(true); }}>تعديل</Button>
              <Button variant="destructive" size="sm" onClick={() => handleDelete(a.id)}>حذف</Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        title={editing ? "تعديل إعلان" : "إضافة إعلان"}
      >
        <form action={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">العنوان *</Label>
            <Input id="title" name="title" defaultValue={editing?.title} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">المحتوى</Label>
            <Textarea id="content" name="content" rows={3} defaultValue={editing?.content || ""} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="startDate">تاريخ البداية</Label><Input id="startDate" name="startDate" type="date" defaultValue={editing ? editing.startDate.toString().split("T")[0] : ""} /></div>
            <div className="space-y-2"><Label htmlFor="endDate">تاريخ النهاية</Label><Input id="endDate" name="endDate" type="date" defaultValue={editing?.endDate ? editing.endDate.toString().split("T")[0] : ""} /></div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isFeatured" defaultChecked={editing?.isFeatured} /> إعلان مميز
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isActive" defaultChecked={editing?.isActive ?? true} /> نشط
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>إلغاء</Button>
            <Button type="submit">حفظ</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
