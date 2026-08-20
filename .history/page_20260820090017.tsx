"use client";

import { useState } from "react";
import { DateRange } from "react-day-picker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-picker-range";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
  }).format(amount);
}

function FinancialReportDisplay({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>إجمالي الإيرادات</CardDescription>
            <CardTitle className="text-2xl text-green-600">{formatCurrency(data.totalRevenue)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>إجمالي المصروفات</CardDescription>
            <CardTitle className="text-2xl text-red-600">{formatCurrency(data.totalExpenses)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>صافي النتيجة</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(data.netResult)}</CardTitle>
          </CardHeader>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>تفاصيل المصروفات حسب البند</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>البند</TableHead>
                <TableHead className="text-left">المبلغ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.expensesBreakdown.map((item: any) => (
                <TableRow key={item.category}>
                  <TableCell>{item.category}</TableCell>
                  <TableCell className="text-left">{formatCurrency(item.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    if (!reportType || !dateRange?.from || !dateRange?.to) {
      setError("يرجى اختيار نوع التقرير وتحديد فترة زمنية.");
      return;
    }
    setError(null);
    setIsLoading(true);
    setReportData(null);

    try {
      const from = dateRange.from.toISOString();
      const to = dateRange.to.toISOString();
      const response = await fetch(`/api/reports/${reportType}?startDate=${from}&endDate=${to}`);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "فشل في توليد التقرير.");
      }

      const data = await response.json();
      setReportData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle>التقارير المتقدمة</CardTitle>
          <CardDescription>اختر نوع التقرير والفترة الزمنية لعرض البيانات.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select onValueChange={setReportType} value={reportType}>
              <SelectTrigger><SelectValue placeholder="اختر نوع التقرير" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="financial">التقرير المالي</SelectItem>
                <SelectItem value="donations">تقرير التبرعات</SelectItem>
              </SelectContent>
            </Select>
            <DatePickerWithRange date={dateRange} setDate={setDateRange} />
            <Button onClick={handleGenerateReport} disabled={isLoading} className="w-full sm:w-auto">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              توليد التقرير
            </Button>
          </div>
          {error && <Alert variant="destructive"><AlertTitle>خطأ</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        </CardContent>
      </Card>

      {isLoading && <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}

      {reportData && (
        <Card>
          <CardHeader>
            <CardTitle>نتائج التقرير</CardTitle>
          </CardHeader>
          <CardContent>
            {reportType === 'financial' && <FinancialReportDisplay data={reportData} />}
            {reportType === 'donations' && <pre className="p-4 bg-muted rounded-md overflow-x-auto"><code>{JSON.stringify(reportData, null, 2)}</code></pre>}
          </CardContent>
        </Card>
      )}
    </main>
  );
}