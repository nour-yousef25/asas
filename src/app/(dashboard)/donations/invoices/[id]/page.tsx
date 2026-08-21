import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const donation = await prisma.donation.findUnique({
    where: { id },
    include: { invoice: true, donor: true, project: true, campaign: true },
  });
  if (!donation || !donation.invoice) return notFound();
  const inv = donation.invoice;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between no-print">
        <h1 className="text-2xl font-bold">فاتورة إلكترونية</h1>
        <button onClick={() => window.print()} className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm">
          طباعة
        </button>
      </div>
      <Card className="p-8 print-area">
        <div className="text-center border-b pb-6">
          <h1 className="text-2xl font-bold">{process.env.ORG_NAME || "جمعية أساس الخيرية"}</h1>
          <p className="text-sm text-muted-foreground mt-1">منشأة غير ربحية - المملكة العربية السعودية</p>
        </div>
        <div className="grid grid-cols-2 gap-6 pt-6">
          <div>
            <p className="text-xs text-muted-foreground mb-1">رقم الفاتورة</p>
            <p className="font-medium">{inv.invoiceNo}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">تاريخ الإصدار</p>
            <p className="font-medium">{formatDate(inv.issuedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">الرقم الضريبي</p>
            <p className="font-medium">{inv.taxNumber}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">المتبرع</p>
            <p className="font-medium">
              {donation.isGuest ? donation.guestName : donation.donor?.name || "متبرع"}
            </p>
          </div>
        </div>
        <div className="mt-6">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="py-2 text-right">الوصف</th>
                <th className="py-2 text-left">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-3">
                  تبرع لـ {donation.project?.title || donation.campaign?.title || "الجمعية"}
                  <p className="text-xs text-muted-foreground">طريقة الدفع: {donation.paymentMethod || "-"}</p>
                </td>
                <td className="py-3 text-left font-medium">{formatCurrency(inv.amount)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr><td className="py-2 text-left font-medium">الضريبة (معفى)</td><td className="py-2 text-left">{formatCurrency(inv.taxAmount)}</td></tr>
              <tr><td className="py-2 text-left font-bold">الإجمالي</td><td className="py-2 text-left font-bold text-primary">{formatCurrency(inv.totalAmount)}</td></tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-8 text-center text-xs text-muted-foreground border-t pt-4">
          <p>هذه فاتورة إلكترونية متوافقة مع متطلبات هيئة الزكاة والضريبة والجمارك (ZATCA)</p>
          <p>برجاء حفظ هذه الفاتورة لأغراض الضرائب</p>
        </div>
      </Card>
    </div>
  );
}
