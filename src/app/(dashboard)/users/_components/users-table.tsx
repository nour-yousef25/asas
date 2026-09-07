"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/toast";

export type MembershipRow = {
  id: string;
  role: string;
  isDefault: boolean;
  createdAt: Date;
  user: { id: string; name: string; email: string | null; phone: string | null; isActive: boolean };
  organizationRoles: Array<{ organizationRole: { name: string } }>;
};

const roleMap: Record<string, { label: string; variant: any }> = {
  ADMIN: { label: "مدير", variant: "default" },
  MEMBER: { label: "عضو", variant: "secondary" },
  VIEWER: { label: "مشاهد", variant: "outline" },
};

export function UsersTable({ data: initialData }: { data: MembershipRow[] }) {
  const { addToast } = useToast();
  const [data, setData] = React.useState(initialData);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const revoke = async (row: MembershipRow) => {
    if (!confirm(`إنهاء عضوية ${row.user.name}؟`)) return;
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/memberships?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setData((current) => current.filter((m) => m.id !== row.id));
      addToast({ type: "success", title: "تم إنهاء العضوية" });
    } catch {
      addToast({ type: "error", title: "تعذر إنهاء العضوية" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DataTable
      data={data}
      searchable
      searchKeys={["user.name", "user.email", "user.phone"] as any}
      emptyMessage="لا توجد عضويات بعد"
      columns={[
        {
          key: "user",
          header: "المستخدم",
          render: (m) => (
            <div>
              <p className="font-medium">{m.user.name}</p>
              <p className="text-xs text-muted-foreground">{m.user.email || m.user.phone || "—"}</p>
            </div>
          ),
        },
        {
          key: "role",
          header: "الدور",
          render: (m) => {
            const r = roleMap[m.role] || { label: m.role, variant: "outline" };
            return (
              <div className="flex items-center gap-1">
                <Badge variant={r.variant}>{r.label}</Badge>
                {m.isDefault && <Badge variant="outline">افتراضي</Badge>}
                {m.organizationRoles.map((mr, i) => (
                  <Badge key={i} variant="secondary">{mr.organizationRole.name}</Badge>
                ))}
              </div>
            );
          },
        },
        {
          key: "status",
          header: "حالة الحساب",
          render: (m) =>
            m.user.isActive
              ? <Badge variant="success">نشط</Badge>
              : <Badge variant="secondary">موقوف</Badge>,
        },
        { key: "createdAt", header: "أضيف في", render: (m) => formatDate(m.createdAt) },
        {
          key: "actions",
          header: "إجراءات",
          render: (m) => (
            <Button
              variant="destructive"
              size="sm"
              disabled={busyId === m.id || m.isDefault}
              onClick={() => revoke(m)}
            >
              إنهاء العضوية
            </Button>
          ),
        },
      ]}
    />
  );
}
