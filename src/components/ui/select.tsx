"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { options?: Option[] }
>(({ className, options, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {options ? options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>) : children}
  </select>
));
Select.displayName = "Select";

export { Select };
