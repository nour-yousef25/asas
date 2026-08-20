import * as React from "react";
import { cn } from "@/lib/utils";

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "default" | "outline" | "ghost" | "destructive" | "secondary" | "link";
    size?: "sm" | "md" | "lg" | "icon";
  }
>(({ className, variant = "default", size = "md", ...props }, ref) => {
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-input bg-background hover:bg-muted",
    ghost: "hover:bg-muted",
    destructive: "bg-danger text-danger-foreground hover:bg-danger/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
    link: "text-primary underline-offset-4 hover:underline",
  };
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
    icon: "h-10 w-10",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variants[variant],
        sizes[size],
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button };
