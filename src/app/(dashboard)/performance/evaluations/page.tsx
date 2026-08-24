"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/data-table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useToast } from "@/components/ui/toast";

type Evaluation = {
  id: string;
  period: string;
  startDate: string;
  endDate: string | null;
  status: string;
  finalScore: number | null;
  employee: { id: string; name: string };
  evaluator: { id: string; name: string };
  _count?: { goals: number; competencies: number };
  goals?: any[];
  competencies?: any[];
};

const statusMap: Record<string, { label: string; variant: any }> = {
  DRAFT: { label: "مسودة", variant: "secondary" },
  IN_PROGRESS: { label: "قيد التقييم", variant: "warning" },
  COMPLETED: { label: "مكتمل", variant: "success" },
  APPROVED: { label: "معتمد", variant: "success" },
  REJECTED: { label: "مرفوض", variant: "danger" },
};

export default function EvaluationsPage() {
  const { addToast } = useToast();
  const [evaluations, setEvaluations] = React.useState<Evaluation[]>([]);
  const [users, setUsers] = React.useState<{ id: string; name: string }[]>([]);
  const [modalOpen, setModalOpen] = React.useState(false);

  const load = async () => {
    const res = await fetch("/api/evaluations");
    setEvaluations(await res.json());
  };
  const loadUsers = async () => {
    const res = await fetch("/api/memberships?page=1&pageSize=100");
    if (!res.ok) {
      setUsers([]);
      return;
    }
    const payload = await res.json();
    setUsers((payload?.data?.data ?? []).flatMap((membership: { user?: { id: string; name?: string } }) => (
      membership.user?.id && membership.user?.name ? [{ id: membership.user.id, name: membership.user.name }] : []
    )));
  };

  React.useEffect(() => { load(); loadUsers(); }, []);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const body = Object.fromEntries(formData.entries());
    const res = await fetch("/api/evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      addToast({ type: "success", title: "تم إنشاء التقييم" });
      setModalOpen(false);
      load();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="تقييمات الموظفين"
        description="نظام مبني على أساس علمي - أهداف وجدارات بنسب محددة لكل موظف لفترة محددة"
        actions={<Button onClick={() => setModalOpen(true)}>تقييم جديد</Button>}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {evaluations.map((ev) => {
          const s = statusMap[ev.status] || { label: ev.status, variant: "outline" };
          const score = ev.finalScore ?? 0;
          return (
            <Card key={ev.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{ev.employee.name}</CardTitle>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </div>
                <CardDescription>الفترة: {ev.period}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {ev.finalScore != null ? (
                    <>
                      <p className="text-xs text-muted-foreground">الدرجة النهائية</p>
                      <div className="flex items-center gap-2">
                        <ProgressBar value={score} showLabel={false} />
                        <span className="text-lg font-bold text-primary">{score}٪</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">التقييم غير مكتمل</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    المقيّم: {ev.evaluator.name}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Link href={`/performance/evaluations/${ev.id}`}>
                      <Button variant="outline" size="sm">إدارة</Button>
                    </Link>
                    {ev.finalScore != null && (
                      <Link href={`/performance/evaluations/${ev.id}/report`}>
                        <Button size="sm">عرض التقرير</Button>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="إنشاء تقييم جديد">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="employeeId">الموظف *</Label>
            <Select name="employeeId" options={[{ value: "", label: "اختر الموظف..." }, ...users.map((u) => ({ value: u.id, label: u.name }))]} />
          </div>
          <div className="space-y-2"><Label htmlFor="period">الفترة *</Label><Input id="period" name="period" placeholder="2026-H1 أو 2026-annual" required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="startDate">تاريخ البداية *</Label><Input id="startDate" name="startDate" type="date" required /></div>
            <div className="space-y-2"><Label htmlFor="endDate">تاريخ النهاية</Label><Input id="endDate" name="endDate" type="date" /></div>
          </div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setModalOpen(false)}>إلغاء</Button><Button type="submit">إنشاء</Button></div>
        </form>
      </Modal>
    </div>
  );
}
