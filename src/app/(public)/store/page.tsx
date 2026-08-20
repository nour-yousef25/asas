import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

type StoreProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  isDigital: boolean;
  isActive: boolean;
};

export default function StorePage() {
  const products = [
    { id: "1", name: "كتاب الجمعية التذكاري", description: "كتاب عن تاريخ وإنجازات الجمعية", price: 50, stock: 100, isDigital: true, isActive: true },
    { id: "2", name: "هدايا خيرية", description: "مجموعة هدايا تبرع", price: 100, stock: 50, isDigital: false, isActive: true },
    { id: "3", name: "سلة الخير", description: "سلة غذائية لعائلة محتاجة", price: 200, stock: 0, isDigital: false, isActive: true },
  ] as StoreProduct[];

  const total = products.reduce((sum, p) => sum + p.price * Math.min(p.stock, 1), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">المتجر الإلكتروني</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <Card key={p.id} className="p-4">
            {p.isDigital && <Badge variant="success" className="text-xs mb-2">رقمي</Badge>}
            {!p.isDigital && <Badge variant="default" className="text-xs mb-2">مادي</Badge>}
            {!p.isActive && <Badge variant="danger" className="text-xs mb-2">نفد المخزون</Badge>}
            <h3 className="font-semibold">{p.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.description}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-xl font-bold text-primary">{formatCurrency(p.price)}</p>
              {p.stock > 0 && <p className="text-sm text-muted-foreground">باقي {p.stock} قطعة</p>}
            </div>
            {!p.isDigital && p.stock > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">الكمية المتاحة: {p.stock}</p>
            )}
            {p.isDigital && (
              <p className="mt-2 text-xs text-muted-foreground">منتج رقمي - متاح للتحميل</p>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-6 p-4 bg-muted rounded-lg">
        <h3 className="font-semibold mb-2">إجمالي المبيعات</h3>
        <p className="text-2xl font-bold text-primary">{formatCurrency(total)}</p>
        <p className="text-sm text-muted-foreground">(قيمة المنتجات المعروضة)</p>
      </div>
    </div>
  );
}