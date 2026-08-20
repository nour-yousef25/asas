"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/data-table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { RadialGaugeComponent } from "@/components/charts";
import { useToast } from "@/components/ui/toast";

type KPIRecord = { id: string; period: string; actualValue: number; targetValue: number; percent: number; notes: string | null };
type KPI = {
  id: string; title: string; description: string | null;
  targetEntity: string; unit: string; targetValue: number;
  strategicGoal: string | null; frequency: string; status: string;
  records: KPIRecord[];
};

const entityMap: Record<string, string> = { DEPARTMENT: "وحدة عمل", PROJECT: "مشروع", EMPLOYEE: "فرد" };
const statusMap: Record<string, { label: string; variant: any }> = {
  ACTIVE: { label: "نشط", variant: "default" },
  ACHIEVED: { label: "محقق", variant: "success" },
  BEHIND: { label: "متأخر", variant: "danger" },
  INACTIVE: { label: "موقوف", variant: "secondary" },
};

export default function KPIPage() {
  const { addToast } = useToast();
  const [kpis, setKpis] = React.useState<KPI[]>([]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [recordModal, setRecordModal] = React.useState<KPI | null>(null);

  const load = async () => {
    const res = await fetch("/api/kpi");
    setKpis(await res.json());
  };
  React.useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const body = Object.fromEntries(formData.entries());
    const res = await fetch("/api/kpi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      addToast({ type: "success", title: "تم إنشاء المؤشر" });
      setModalOpen(false);
      load();
    }
  };

  const handleAddRecord = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!recordModal) return;
    const formData = new FormData(e.currentTarget);
    const body = {
      kpiId: recordModal.id,
      period: formData.get("period"),
      actualValue: parseFloat(formData.get("actualValue") as string),
      targetValue: recordModal.targetValue,
      notes: formData.get("notes"),
    };
    const res = await fetch("/api/kpi", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      addToast({ type: "success", title: "تم تسجيل القياس" });
      setRecordModal(null);
      load();
    }
  };

  const latestRecord = (k: KPI) => k.records[0];
  const computePercent = (k: KPI) => {
    const r = latestRecord(k);
    if (!r) return 0;
    return k.targetValue > 0 ? Math.round((r.actualValue / k.targetValue) * 100) : 0;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="مؤشرات الأداء الرئيسية (KPI)"
        description="قياس أداء وحدات الأعمال والمشاريع والأفراد مقارنة بالأهداف الاستراتيجية"
        actions={<Button onClick={() => setModalOpen(true)}>إضافة مؤشر جديد</Button>}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => {
          const percent = computePercent(k);
          const s = statusMap[k.status] || { label: k.status, variant: "outline" };
          return (
            <Card key={k.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{k.title}</CardTitle>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </div>
                {k.description && <CardDescription className="line-clamp-2">{k.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24">
                    <RadialGaugeComponent value={percent} height={96} />
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">الكيان:</span><span className="font-medium">{entityMap[k.targetEntity]}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">الهدف:</span><span className="font-medium">{k.targetValue} {k.unit}</span></div>
                    {latestRecord(k) && (
                      <div className="flex justify-between gap-3"><span className="text-muted-foreground">المحقق:</span><span className="font-medium text-primary">{latestRecord(k).actualValue} {k.unit}</span></div>
                    )}
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">الفترة:</span><span className="font-medium">{k.frequency === "monthly" ? "شهري" : k.frequency === "quarterly" ? "ربع سنوي" : "سنوي"}</span></div>
                  </div>
                </div>
                {k.strategicGoal && (
                  <p className="mt-3 text-xs text-muted-foreground border-t pt-2">الهدف الاستراتيجي: {k.strategicGoal}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setRecordModal(k)}>تسجيل قياس</Button>
                  <Link href={`/performance/kpi/${k.id}/report`}>
                    <Button size="sm">عرض التقرير</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="إضافة مؤشر أداء جديد">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="title">عنوان المؤشر *</Label><Input id="title" name="title" required /></div>
          <div className="space-y-2"><Label htmlFor="description">الوصف</Label><Textarea id="description" name="description" rows={2} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="targetEntity">الكيان المستهدف</Label>
              <Select name="targetEntity" options={[
                { value: "DEPARTMENT", label: "وحدة عمل" },
                { value: "PROJECT", label: "مشروع" },
                { value: "EMPLOYEE", label: "فرد / موظف" },
              ]} /></div>
            <div className="space-y-2"><Label htmlFor="frequency">دورية القياس</Label>
              <Select name="frequency" options={[
                { value: "monthly", label: "شهري" },
                { value: "quarterly", label: "ربع سنوي" },
                { value: "yearly", label: "سنوي" },
              ]} /></div>
            <div className="space-y-2"><Label htmlFor="targetValue">القيمة المستهدفة *</Label><Input id="targetValue" name="targetValue" type="number" step="0.01" required /></div>
            <div className="space-y-2"><Label htmlFor="unit">وحدة القياس *</Label><Input id="unit" name="unit" required placeholder="٪، عدد، ريال..." /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="strategicGoal">الهدف الاستراتيجي المرتبط</Label><Input id="strategicGoal" name="strategicGoal" /></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setModalOpen(false)}>إلغاء</Button><Button type="submit">حفظ المؤشر</Button></div>
        </form>
      </Modal>

      <Modal open={!!recordModal} onClose={() => setRecordModal(null)} title={`تسجيل قياس جديد: ${recordModal?.title || ""}`}>
        <form onSubmit={handleAddRecord} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="period">الفترة *</Label><Input id="period" name="period" required placeholder="2026-Q2 أو 2026-08 أو 2026" /></div>
          <div className="space-y-2"><Label htmlFor="actualValue">القيمة الفعلية المحققة * <span className="text-muted-foreground">(الهدف: {recordModal?.targetValue} {recordModal?.unit})</span></Label><Input id="actualValue" name="actualValue" type="number" step="0.01" required /></div>
          <div className="space-y-2"><Label htmlFor="notes">ملاحظات</Label><Textarea id="notes" name="notes" rows={2} /></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setRecordModal(null)}>إلغاء</Button><Button type="submit">تسجيل</Button></div>
        </form>
      </Modal>
    </div>
  );
}
