"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { formatCurrency, formatDate } from "@/lib/format";

export type DonationRow = {
  id: string;
  amount: number;
  paymentMethod: string | null;
  paymentRef: string | null;
  status: string;
  isGuest: boolean;
  isAnonymous: boolean;
  guestName: string | null;
  guestPhone: string | null;
  createdAt: Date;
  donor: { name: string } | null;
  campaign: { title: string } | null;
  project: { title: string } | null;
  invoice: { invoiceNo: string } | null;
};

const statusMap: Record<string, { label: string; variant: any }> = {
  COMPLETED: { label: "مكتمل", variant: "success" },
  PENDING: { label: "معلق", variant: "warning" },
  FAILED: { label: "فشل", variant: "danger" },
  REFUNDED: { label: "مسترد", variant: "secondary" },
};

export function DonationsTable({ data }: { data: DonationRow[] }) {
  return (
    <DataTable
      data={data}
      searchable
      searchKeys={["amount", "paymentRef", "guestName", "guestPhone"] as any}
      columns={[
        { key: "createdAt", header: "التاريخ", render: (d) => formatDate(d.createdAt) },
        { key: "donor", header: "المتبرع",
          render: (d) => {
            if (d.isAnonymous) return "متبرع مجهول";
            if (d.isGuest) return d.guestName || "زائر";
            return d.donor?.name || "-";
          },
        },
        { key: "phone", header: "الجوال", render: (d) => d.guestPhone || "-" },
        { key: "amount", header: "المبلغ", render: (d) => <span className="font-medium text-primary">{formatCurrency(d.amount)}</span> },
        { key: "method", header: "طريقة الدفع", render: (d) => d.paymentMethod || "-" },
        { key: "target", header: "الجهة",
          render: (d) => d.project?.title || d.campaign?.title || "تبرع عام" },
        { key: "invoice", header: "الفاتورة", render: (d) =>
          d.invoice?.invoiceNo ?
            (<a href={`/donations/invoices/${d.id}`} className="text-primary hover:underline text-xs">{d.invoice.invoiceNo}</a>)
            : "-",
        },
        { key: "status", header: "الحالة",
          render: (d) => {
            const s = statusMap[d.status] || { label: d.status, variant: "outline" };
            return <Badge variant={s.variant}>{s.label}</Badge>;
          },
        },
      ]}
    />
  );
}
