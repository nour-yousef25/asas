"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/data-table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

export default function ImportBeneficiariesPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [uploading, setUploading] = React.useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      // خريطة الحقول (تدعم العربية والإنجليزية)
      const rows = XLSX.utils.sheet_to_json<any>(ws);
      const filtered = rows.map((row) => ({
        name: row["الاسم"] || row.name,
        nationalId: row["الهوية"] || row.nationalId,
        phone: String(row["الجوال"] || row.phone || "").trim(),
        email: row["البريد"] || row.email,
        address: row["العنوان"] || row.address,
        city: row["المدينة"] || row.city,
        gender: row["الجنس"] === "أنثى" ? "FEMALE" : "MALE",
        familyMembers: row["أفراد الأسرة"] || row.familyMembers,
        needCategory: row["فئة الاحتياج"] || row.needCategory,
      })).filter((r) => r.name && r.phone);
      const res = await fetch("/api/beneficiaries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(filtered) });
      if (!res.ok) throw new Error();
      addToast({ type: "success", title: "تم الاستيراد", description: `${filtered.length} مستفيد` });
      router.push("/beneficiaries");
      router.refresh();
    } catch {
      addToast({ type: "error", title: "خطأ", description: "تعذر استيراد الملف" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="استيراد المستفيدين من Excel" description="استيراد قائمة المستفيدين دفعة واحدة من ملف Excel" />
      <Card className="p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          <div>
            <h3 className="font-semibold">رفع ملف Excel</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md">
              يجب أن يحتوي الملف على الأعمدة التالية: الاسم، الجوال، ومن المفضل إدراج: الهوية، المدينة، فئة الاحتياج
            </p>
          </div>
          <div className="flex gap-2">
            <Label htmlFor="file" className="cursor-pointer">
              <Button disabled={uploading}>
                {uploading ? "جارٍ الرفع والاستيراد..." : "اختيار ملف Excel"}
              </Button>
              <input id="file" type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
            </Label>
          </div>
        </div>
      </Card>
    </div>
  );
}
