import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ReportHeader, ReportTitle, ReportSignature, ReportFooter, PrintButton } from "@/components/print/print-report";
import { Card } from "@/components/ui/card";
import { BarChartComponent, RadialGaugeComponent } from "@/components/charts";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatDate, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

const entityMap: Record<string, string> = { DEPARTMENT: "وحدة عمل", PROJECT: "مشروع", EMPLOYEE: "فرد / موظف" };

export default async function KPIReportPage({ params }: { params: { id: string } }) {
  const kpi = await prisma.kPI.findUnique({
    where: { id: params.id },
    include: { records: { orderBy: { period: "asc" } } },
  });
  if (!kpi) return notFound();

  const latest = kpi.records[kpi.records.length - 1];
  const percent = latest && kpi.targetValue > 0 ? Math.round((latest.actualValue / kpi.targetValue) * 100) : 0;
  const chartData = kpi.records.map((r) => ({
    period: r.period,
    actual: r.actualValue,
    target: r.targetValue,
  }));

  return (
    <div className="space-y-4">
      <div className="flex justify-end no-print">
        <PrintButton />
      </div>

      <Card className="p-8 print-area">
        <ReportHeader
          title="تقرير مؤشر الأداء الرئيسي"
          reportNumber={`KPI-${kpi.id.slice(-8).toUpperCase()}`}
          date={formatDate(new Date())}
        />

        <ReportTitle
          title={kpi.title}
          subtitle="تقرير رسمي عن قياس الأداء مقارنة بالأهداف الاستراتيجية"
        />

        {/* ملخص تنفيذي */}
        <div className="mb-6">
          <h3 className="font-bold mb-2 border-r-4 border-primary pr-2">ملخص تنفيذي</h3>
          <p className="text-sm leading-7">
            {kpi.description || "لا يوجد وصف."}
          </p>
          <p className="text-sm mt-2 leading-7">
            يهدف هذا التقرير إلى قياس مدى تحقق المؤشر &laquo;{kpi.title}&raquo; خلال الفترات المسجلة،
            ومقارنة الأداء الفعلي بالقيمة المستهدفة وهي {formatNumber(kpi.targetValue)} {kpi.unit}.
            آخر قياس مسجل يبين تحقق {percent}٪ من المستهدف.
          </p>
        </div>

        {/* بيانات المؤشر */}
        <div className="mb-6">
          <h3 className="font-bold mb-3 border-r-4 border-primary pr-2">بيانات المؤشر</h3>
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr className="border-b"><td className="py-2 bg-muted/30 font-medium">الكيان المستهدف</td><td className="py-2 pr-4">{entityMap[kpi.targetEntity]}</td></tr>
              <tr className="border-b"><td className="py-2 bg-muted/30 font-medium">القيمة المستهدفة</td><td className="py-2 pr-4">{formatNumber(kpi.targetValue)} {kpi.unit}</td></tr>
              <tr className="border-b"><td className="py-2 bg-muted/30 font-medium">دورية القياس</td><td className="py-2 pr-4">{kpi.frequency === "monthly" ? "شهري" : kpi.frequency === "quarterly" ? "ربع سنوي" : "سنوي"}</td></tr>
              {kpi.strategicGoal && (
                <tr className="border-b"><td className="py-2 bg-muted/30 font-medium">الهدف الاستراتيجي</td><td className="py-2 pr-4">{kpi.strategicGoal}</td></tr>
              )}
              <tr className="border-b"><td className="py-2 bg-muted/30 font-medium">حالة المؤشر</td><td className="py-2 pr-4">{kpi.status === "ACHIEVED" ? "محقق" : kpi.status === "BEHIND" ? "متأخر عن المستهدف" : "نشط"}</td></tr>
            </tbody>
          </table>
        </div>

        {/* المؤشر الرئيسي للإنجاز */}
        <div className="mb-6">
          <h3 className="font-bold mb-3 border-r-4 border-primary pr-2">مؤشر الإنجاز الحالي</h3>
          <div className="flex flex-col items-center">
            <RadialGaugeComponent value={percent} height={200} />
            <p className="mt-2 text-3xl font-bold text-primary">٪{percent}</p>
            <p className="text-sm text-muted-foreground">نسبة تحقق المؤشر</p>
          </div>
        </div>

        {/* سجل القياسات */}
        {kpi.records.length > 0 && (
          <div className="mb-6">
            <h3 className="font-bold mb-3 border-r-4 border-primary pr-2">سجل القياسات</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="py-2 text-right">الفترة</th>
                  <th className="py-2 text-right">القيمة الفعلية</th>
                  <th className="py-2 text-right">القيمة المستهدفة</th>
                  <th className="py-2 text-right">نسبة الإنجاز</th>
                  <th className="py-2 text-right">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {kpi.records.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="py-2">{r.period}</td>
                    <td className="py-2 pr-4">{formatNumber(r.actualValue)} {kpi.unit}</td>
                    <td className="py-2 pr-4">{formatNumber(r.targetValue)} {kpi.unit}</td>
                    <td className="py-2 pr-4"><ProgressBar value={r.percent} showLabel={false} size="sm" /></td>
                    <td className="py-2 pr-4 text-muted-foreground">{r.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* رسم بياني */}
        {chartData.length > 0 && (
          <div className="mb-6">
            <h3 className="font-bold mb-3 border-r-4 border-primary pr-2">رسم بياني للمقارنة بين الفعلي والمستهدف</h3>
            <BarChartComponent
              data={chartData}
              xKey="period"
              yKeys={[
                { key: "actual", name: "القيمة الفعلية", color: "#0d9488" },
                { key: "target", name: "القيمة المستهدفة", color: "#dc2626" },
              ]}
              height={250}
            />
          </div>
        )}

        {/* التوصيات */}
        <div className="mb-6">
          <h3 className="font-bold mb-3 border-r-4 border-primary pr-2">التوصيات</h3>
          <ul className="text-sm space-y-1 list-disc list-inside leading-7">
            {percent >= 100 && <li>تم تحقيق المستهدف بنجاح، يوصى بالحفاظ على هذا المستوى من الأداء.</li>}
            {percent >= 75 && percent < 100 && <li>الأداء جيد وقريب من المستهدف، يوصى بتكثيف الجهود في الفترة القادمة.</li>}
            {percent >= 50 && percent < 75 && <li>الأداء متوسط، يوصى بمراجعة الخطة التنفيذية وإزالة المعوقات.</li>}
            {percent < 50 && <li>الأداء أقل من المطلوب، يوصى بعقد اجتماع طارئ لمراجعة الأسباب ووضع خطة تصحيحية.</li>}
            <li>متابعة القياس {kpi.frequency === "monthly" ? "الشهري" : kpi.frequency === "quarterly" ? "الربع سنوي" : "السنوي"} بشكل منتظم.</li>
          </ul>
        </div>

        <ReportSignature
          signatories={[
            { title: "مدير الأداء", name: "" },
            { title: "الرئيس التنفيذي", name: "" },
          ]}
        />

        <ReportFooter text="هذا التقرير صادر عن نظام مؤشرات الأداء الرئيسية (KPI) في منصة أساس لإدارة الجمعيات الخيرية" />
      </Card>
    </div>
  );
}
