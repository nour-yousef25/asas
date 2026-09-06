"use client";

// مكون رأس التقرير الرسمي القابل للطباعة
// يحتوي شعار الجمعية، اسم الجمعية، عنوان التقرير، التاريخ
export function ReportHeader({
  title,
  subtitle,
  reportNumber,
  date,
}: {
  title: string;
  subtitle?: string;
  reportNumber?: string;
  date?: string;
}) {
  return (
    <div className="flex items-start justify-between border-b-2 border-primary pb-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary text-primary-foreground text-2xl font-bold">
          أ
        </div>
        <div>
          <h1 className="text-xl font-bold">{process.env.ORG_NAME || "جمعية أساس الخيرية"}</h1>
          <p className="text-sm text-muted-foreground">منشأة غير ربحية - المملكة العربية السعودية</p>
          {process.env.ORG_TAX_NUMBER && (
            <p className="text-xs text-muted-foreground">الرقم الضريبي: {process.env.ORG_TAX_NUMBER}</p>
          )}
        </div>
      </div>
      <div className="text-left">
        <p className="text-xs text-muted-foreground">رقم التقرير</p>
        <p className="font-mono text-sm">{reportNumber || "-"}</p>
        <p className="text-xs text-muted-foreground mt-2">تاريخ الإصدار</p>
        <p className="text-sm">{date || new Date().toLocaleDateString("ar-SA")}</p>
      </div>
    </div>
  );
}

// مكون عنوان التقرير
export function ReportTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="text-center mb-6">
      <h2 className="text-2xl font-bold text-primary">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

// مكون توقيع التقرير
export function ReportSignature({
  signatories = [{ title: "مدير الجمعية", name: "" }, { title: "الرئيس التنفيذي", name: "" }],
}: {
  signatories?: { title: string; name: string }[];
}) {
  return (
    <div className="mt-12 grid grid-cols-2 gap-6 print-signatures">
      {signatories.map((s, i) => (
        <div key={i} className="text-center">
          <div className="mx-auto mb-2 h-16 border-b border-dashed" />
          <p className="font-medium">{s.name || "...................."}</p>
          <p className="text-sm text-muted-foreground">{s.title}</p>
        </div>
      ))}
    </div>
  );
}

// مكون تذييل التقرير
export function ReportFooter({ text }: { text?: string }) {
  return (
    <div className="mt-8 border-t pt-4 text-center text-xs text-muted-foreground">
      {text || `تم إنشاء هذا التقرير بواسطة منصة أساس لإدارة الجمعيات الخيرية · ${new Date().toLocaleDateString("ar-SA")}`}
    </div>
  );
}

// زر الطباعة
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
    >
      <span className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
        </svg>
        طباعة التقرير
      </span>
    </button>
  );
}
