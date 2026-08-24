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
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

export default function TasksPage() {
  const { addToast } = useToast();
  const [tasks, setTasks] = React.useState<any[]>([]);
  const [assigneeOptions, setAssigneeOptions] = React.useState<Array<{ value: string; label: string }>>([]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [isEdit, setIsEdit] = React.useState(false);
  const [currentTask, setCurrentTask] = React.useState<any>(null);

  const load = async () => {
    const res = await fetch("/api/tasks");
    setTasks(await res.json());
  };
  React.useEffect(() => { load(); }, []);
  React.useEffect(() => {
    const loadAssignees = async () => {
      try {
        const response = await fetch("/api/memberships?page=1&pageSize=100");
        if (!response.ok) return;
        const payload = await response.json();
        const memberships = payload?.data?.data ?? [];
        setAssigneeOptions(
          memberships.flatMap((membership: { user?: { id: string; name?: string; email?: string } }) => (
            membership.user?.id
              ? [{ value: membership.user.id, label: membership.user.name || membership.user.email || membership.user.id }]
              : []
          )),
        );
      } catch {
        setAssigneeOptions([]);
      }
    };
    loadAssignees();
  }, []);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const dueDate = formData.get("dueDate")?.toString();
    const body = {
      title: formData.get("title")?.toString() ?? "",
      description: formData.get("description")?.toString() || null,
      status: formData.get("status")?.toString() || "TODO",
      priority: formData.get("priority")?.toString() || "MEDIUM",
      assigneeId: formData.get("assigneeId")?.toString() || null,
      department: formData.get("department")?.toString() || null,
      tags: formData
        .get("tags")
        ?.toString()
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean) ?? [],
      ...(dueDate ? { dueDate: new Date(dueDate).toISOString() } : {}),
    };
    
    try {
      if (isEdit && currentTask) {
        await fetch(`/api/tasks/${currentTask.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      setModalOpen(false);
      setIsEdit(false);
      setCurrentTask(null);
      load();
      addToast({ type: "success", title: isEdit ? "تم التحديث" : "تمت الإضافة" });
    } catch {
      addToast({ type: "error", title: "خطأ", description: "تعذرت العملية" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    load();
    addToast({ type: "success", title: "تم الحذف" });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="إدارة المهام"
        description="إسناد وتكليف وإضافة المهام، والمتابعة، وتحديد الأولويات، وتواريخ الاستحقاق، وميزة التعليقات على المهام وإرفاق ملفات في التعليق"
        actions={<Button onClick={() => setModalOpen(true)}>إضافة مهمة جديدة</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tasks.map((t) => {
          const statusMap: any = { TODO: "To Do", IN_PROGRESS: "In Progress", REVIEW: "Review", DONE: "Done", CANCELLED: "Cancelled" };
          const priorityMap: any = { LOW: "low", MEDIUM: "medium", HIGH: "high", URGENT: "urgent" };
          const s = statusMap[t.status] || t.status;
          const p = priorityMap[t.priority] || t.priority;
          return (
            <Card key={t.id} className="p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{t.description || "-"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{s}</Badge>
                    <Badge variant={p} className="text-xs">{p}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.dueDate ? new Date(t.dueDate).toLocaleDateString("ar-SA") : "-"}</p>
                </div>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                <Badge variant="secondary" className="text-xs">تعليقات: {t.comments.length}</Badge>
                <Link href={`/tasks/${t.id}`} className="text-primary hover:underline text-xs">عرض التفاصيل</Link>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setIsEdit(false); setCurrentTask(null); }} title={isEdit ? "تعديل مهمة" : "إضافة مهمة جديدة"}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            type="hidden"
            name="id"
            defaultValue={isEdit && currentTask ? currentTask.id : ""}
          />
          <div className="space-y-2"><Label htmlFor="title">عنوان المهمة *</Label><Input id="title" name="title" required defaultValue={isEdit && currentTask ? currentTask.title : ""} /></div>
          <div className="space-y-2"><Label htmlFor="description">الوصف</Label><Textarea id="description" name="description" rows={3} defaultValue={isEdit && currentTask ? currentTask.description : ""} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="status">الحالة</Label><Select name="status" defaultValue="TODO" options={[
              { value: "TODO", label: "To Do" }, { value: "IN_PROGRESS", label: "In Progress" }, { value: "REVIEW", label: "Review" }, { value: "DONE", label: "Done" }, { value: "CANCELLED", label: "Cancelled" }]} /></div>
            <div className="space-y-2"><Label htmlFor="priority">الأولوية</Label><Select name="priority" defaultValue="MEDIUM" options={[
              { value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" }, { value: "HIGH", label: "High" }, { value: "URGENT", label: "Urgent" }]} /></div>
            <div className="space-y-2"><Label htmlFor="dueDate">تاريخ الاستحقاق</Label><Input id="dueDate" name="dueDate" type="date" /></div>
            <div className="space-y-2"><Label htmlFor="assigneeId">المسؤول</Label><Select name="assigneeId" options={assigneeOptions} /></div>
            <div className="space-y-2"><Label htmlFor="department">القسم</Label><Input id="department" name="department" /></div>
            <div className="space-y-2"><Label htmlFor="tags">الكلمات المفتاحية (مفصولة بفاصلة)</Label><Input id="tags" name="tags" placeholder="مثال: عاجل,إدارة,اجتماع" /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { setModalOpen(false); setIsEdit(false); setCurrentTask(null); }}>إلغاء</Button>
            <Button type="submit">{isEdit ? "تحديث" : "إضافة مهمة"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
