"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname?.split("/").filter(Boolean) || [];

  if (segments.length === 0) return null;

  const labels: Record<string, string> = {
    news: "الأخبار",
    gallery: "مكتبة الصور",
    content: "الأنظمة والتعليمات",
    announcements: "الإعلانات",
    members: "الأعضاء",
    volunteers: "المتطوعون",
    beneficiaries: "المستفيدون",
    donations: "التبرعات",
    donors: "المانحون",
    projects: "المشاريع",
    events: "الفعاليات",
    tasks: "المهام",
    surveys: "الاستبيانات",
    performance: "الأداء",
    kpi: "مؤشرات الأداء",
    evaluations: "تقييمات الموظفين",
    store: "المتجر",
    finance: "الشؤون المالية",
    reports: "التقارير",
    sms: "رسائل SMS",
    notifications: "الإشعارات",
    organization: "الجمعية",
    users: "المستخدمون",
    settings: "الإعدادات",
    trial: "طلبات التجربة",
    new: "إضافة",
    edit: "تعديل",
    report: "تقرير",
    import: "استيراد",
    portal: "بوابة المستفيد",
  };

  let href = "";

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      <Link href="/" className="hover:text-foreground">الرئيسية</Link>
      {segments.map((seg, i) => {
        href += `/${seg}`;
        const isLast = i === segments.length - 1;
        return (
          <React.Fragment key={href}>
            <span className="mx-1">/</span>
            {isLast ? (
              <span className="text-foreground font-medium">{labels[seg] || seg}</span>
            ) : (
              <Link href={href} className="hover:text-foreground">{labels[seg] || seg}</Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
