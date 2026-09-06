"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";

export default function SMSPage() {
  const { addToast } = useToast();
  const [templates, setTemplates] = React.useState<any[]>([]);
  const [showTemplateModal, setShowTemplateModal] = React.useState(false);
  const [campaignSending, setCampaignSending] = React.useState(false);

  const loadTemplates = async () => {
    const res = await fetch("/api/sms");
    const data = await res.json();
    setTemplates(Array.isArray(data) ? data : []);
  };
  React.useEffect(() => { loadTemplates(); }, []);

  const handleTemplateSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const body = {
      name: formData.get("name")?.toString() ?? "",
      category: formData.get("category")?.toString() ?? "",
      content: formData.get("content")?.toString() ?? "",
      isFeatured: formData.get("isFeatured") === "on",
      isActive: formData.get("isActive") === "on",
    };
    const res = await fetch("/api/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      addToast({ type: "success", title: "تم الحفظ" });
      setShowTemplateModal(false);
      loadTemplates();
    }
  };

  const handleCampaignSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCampaignSending(true);
    const formData = new FormData(e.currentTarget);
    const phones = formData.get("phones")?.toString().split("\n").filter((p) => p.trim()).map((p) => p.trim()) || [];
    const res = await fetch("/api/sms/campaign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phones,
        templateId: formData.get("templateId"),
        phrases: {
          name: formData.get("phrases_name") || "",
          amount: formData.get("phrases_amount") || "",
          date: formData.get("phrases_date") || formatDate(new Date()),
        },
      }),
    });
    const data = await res.json();
    if (data.success) {
      addToast({ type: "success", title: "تم الإرسال", description: `تم الإرسال لـ ${data.succeeded} من ${data.phones.length}` });
    } else {
      addToast({ type: "error", title: "خطأ", description: data.message || "تعذر الإرسال" });
    }
    setCampaignSending(false);
  };

  const handleSingleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const phones = formData.get("phones")?.toString().split("\n").filter((p) => p.trim()) || [];
    if (phones.length === 0) {
      addToast({ type: "error", title: "خطأ", description: "يجب إدخال أرقام الهواتف" });
      return;
    }
    const res = await fetch("/api/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phones,
        templateId: formData.get("templateId") || "",
        phrases: {
          name: formData.get("phrases_name") || "",
          amount: formData.get("phrases_amount") || "",
          date: formData.get("phrases_date") || formatDate(new Date()),
        },
      }),
    });
    const data = await res.json();
    if (data.success) {
      addToast({ type: "success", title: "تم الإرسال", description: `تم الإرسال لـ ${data.logs.length} رقم` });
    } else {
      addToast({ type: "error", title: "خطأ", description: data.message || "تعذر الإرسال" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">رسائل SMS</h1>
        <Button onClick={() => setShowTemplateModal(true)}>قالب جديد</Button>
      </div>

      {/* إدارة القوالب */}
      <Card className="p-4">
        <CardHeader>
          <CardTitle>إدارة قوالب الرسائل</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="p-2 rounded-md border bg-muted/30 space-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.category}</p>
                  </div>
                  <Badge variant="outline">{t.isActive ? "نشط" : "مقفل"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{t.content}</p>
              </div>
            ))}
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد قوالب بعد</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* إرسال رسالة فردية */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="p-4">
          <CardHeader><CardTitle>إرسال رسالة</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleSingleSend}>
              <div className="space-y-3">
                <Textarea name="phones" placeholder="أرقام الهواتف (مجدولة، كل رقم على سطر)" rows={3} required />
                <Select name="templateId" options={templates.map((t) => ({ value: t.id, label: t.name }))} />
                <div className="grid grid-cols-2 gap-2">
                  <Input name="phrases_name" placeholder="اسم المتلقي" />
                  <Input name="phrases_amount" placeholder="المبلغ" type="number" />
                </div>
                <Input name="phrases_date" placeholder="التاريخ" type="date" defaultValue={formatDate(new Date())} />
                <div className="text-xs text-muted-foreground">يمكن استخدام {'{{name}}'}، {'{{amount}}'}، {'{{date}}'} في القالب</div>
                <Button type="submit" className="w-full">إرسال</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* بطاقات الإحصائيات */}
        <Card className="p-4">
          <CardHeader><CardTitle>إحصائيات الرسائل</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">عدد القوالب: {templates.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">الرسائل المرسلة: (في انتظار البيانات)</p>
          </CardContent>
        </Card>
      </div>

      {/* نافذة قالب جديد */}
      <Modal open={showTemplateModal} onClose={() => setShowTemplateModal(false)} title="قالب جديد">
        <form onSubmit={handleTemplateSave} className="space-y-4">
          <Input name="name" placeholder="اسم القالب" required />
          <Input name="category" placeholder="الفئة" />
          <Textarea name="content" placeholder="محتوى الرسالة" rows={3} required />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isFeatured" defaultChecked /> مميز
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked /> نشط
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowTemplateModal(false)}>إلغاء</Button>
            <Button type="submit">حفظ</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
