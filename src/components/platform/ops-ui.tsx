/**
 * فلسفة التصميم: سجلّ المؤسسة الهادئ — بيانات دقيقة، تباين محدود، وقرارات واضحة.
 * تستخدم هذه المكونات في صفحات ASAS الإدارية لتقديم تسلسل عمل موحّد باللغة العربية.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-l from-teal-950 via-teal-800 to-teal-700 px-6 py-7 text-white shadow-sm sm:px-8">
      <div className="pointer-events-none absolute -left-14 -top-16 h-52 w-52 rounded-full border border-white/15" />
      <div className="pointer-events-none absolute -bottom-24 left-24 h-48 w-48 rounded-full bg-amber-300/10 blur-3xl" />
      <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-[0.18em] text-teal-100">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-xl text-sm leading-7 text-teal-50/90">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "teal",
}: {
  label: string;
  value: ReactNode;
  detail: string;
  tone?: "teal" | "amber" | "slate" | "rose";
}) {
  const toneClass = {
    teal: "border-teal-100 bg-teal-50/55 text-teal-800",
    amber: "border-amber-100 bg-amber-50/60 text-amber-800",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
    rose: "border-rose-100 bg-rose-50/60 text-rose-800",
  }[tone];

  return (
    <article className={cn("rounded-xl border p-4 transition-transform duration-200 hover:-translate-y-0.5", toneClass)}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

export function WorkspaceCard({
  title,
  description,
  meta,
  status,
  children,
}: {
  title: string;
  description: string;
  meta?: string;
  status?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition-shadow duration-200 hover:shadow-[0_10px_25px_rgb(15_23_42/0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {status}
      </div>
      {meta && <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">{meta}</p>}
      {children && <div className="mt-4">{children}</div>}
    </article>
  );
}

export function QuietLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-bold text-teal-700 transition-colors hover:text-teal-900">
      {children}
      <span aria-hidden>←</span>
    </Link>
  );
}

export function StatusPill({ label, tone = "slate" }: { label: string; tone?: "teal" | "amber" | "slate" | "rose" }) {
  const toneClass = {
    teal: "bg-teal-100 text-teal-800",
    amber: "bg-amber-100 text-amber-800",
    slate: "bg-slate-100 text-slate-700",
    rose: "bg-rose-100 text-rose-800",
  }[tone];
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold", toneClass)}>{label}</span>;
}

export function EmptyWorkspace({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <section className="rounded-xl border border-dashed bg-slate-50/70 p-8 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-teal-100 text-lg text-teal-800">+</div>
      <h2 className="mt-3 font-bold text-slate-900">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
}
