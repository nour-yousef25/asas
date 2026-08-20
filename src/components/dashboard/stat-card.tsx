import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  color?: "primary" | "secondary" | "accent" | "success" | "warning" | "danger";
  subtitle?: string;
}

const colorClasses = {
  primary: "text-primary bg-primary/10",
  secondary: "text-secondary bg-secondary/10",
  accent: "text-accent-foreground bg-accent/20",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  danger: "text-danger bg-danger/10",
};

export function StatCard({ title, value, icon, trend, color = "primary", subtitle }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <div
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                trend.isPositive ? "text-success" : "text-danger",
              )}
            >
              <span>{trend.isPositive ? "▲" : "▼"}</span>
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-muted-foreground">عن الشهر الماضي</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-lg", colorClasses[color])}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
