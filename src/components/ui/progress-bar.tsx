import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ProgressBar({ value, max = 100, className, showLabel = true, size = "md" }: ProgressBarProps) {
  const percent = Math.min(100, Math.round((value / max) * 100));
  const colors = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    primary: "bg-primary",
  };
  const color = percent >= 80 ? colors.success : percent >= 50 ? colors.primary : percent >= 25 ? colors.warning : colors.danger;
  const sizes = {
    sm: "h-2",
    md: "h-3",
    lg: "h-4",
  };
  return (
    <div className={cn("w-full", className)}>
      <div className={cn("w-full overflow-hidden rounded-full bg-muted", sizes[size])}>
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>%{percent}</span>
        </div>
      )}
    </div>
  );
}
