"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/data-table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

export default function RenewPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { addToast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [member, setMember] = React.useState<any>(null);

  React.useEffect(() => {
    fetch(`/api/members`)
      .then((r) => r.json())
      .then((list) => setMember(list.find((m: any) => m.id === id)));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const body = { amount: formData.get("amount"), paymentMethod: formData.get("paymentMethod") };
    try {
      const res = await fetch(`/api/members/${id}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      addToast({ type: "success", title: "تم التجديد", description: "تم تجديد العضوية وتسجيل الدفعة بنجاح" });
      router.push(`/members/${id}`);
      router.refresh();
    } catch {
      addToast({ type: "error", title: "خطأ", description: "تعذرت عملية التجديد" });
    } finally {
      setLoading(false);
    }
  };

  if (!member) return <div className="p-4">جارٍ التحميل...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="تجديد العضوية" description={`تجديد عضوية: ${member.user?.name}`} />
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">مبلغ التجديد (ريال) *</Label>
              <Input id="amount" name="amount" type="number" min="1" step="0.01" defaultValue={member.membershipFee} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">طريقة الدفع</Label>
              <Select name="paymentMethod" options={[
                { value: "mada", label: "مدى" },
                { value: "visa", label: "فيزا" },
                { value: "bank_transfer", label: "تحويل بنكي" },
                { value: "cash", label: "نقداً" },
              ]} />
            </div>
          </div>
          <div className="rounded-lg bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              سيتم تمديد عضوية العضو لمدة عام كامل (٣٦٥ يوماً) اعتباراً من تاريخ الانتهاء الحالي.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>إلغاء</Button>
            <Button type="submit" disabled={loading}>{loading ? "جارٍ المعالجة..." : "تجديد العضوية"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
