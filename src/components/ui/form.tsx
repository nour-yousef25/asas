"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Form = ({ children, ...props }: React.FormHTMLAttributes<HTMLFormElement>) => (
  <form {...props}>{children}</form>
);

const FormField = ({ render, name, control }: any) => {
  const field = {
    name,
    value: control?._formValues?.[name] ?? "",
    onChange: (e: any) => control?.setValue?.(name, e?.target?.value ?? e),
    onBlur: () => {},
  };
  return render({ field });
};

const FormItem = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("space-y-2", className)}>{children}</div>
);

const FormLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <label className={cn("text-sm font-medium leading-none", className)}>{children}</label>
);

const FormControl = ({ children }: { children: React.ReactNode }) => <>{children}</>;

const FormDescription = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>
);

const FormMessage = ({ children, className }: { children?: React.ReactNode; className?: string }) =>
  children ? <p className={cn("text-sm text-destructive", className)}>{children}</p> : null;

export { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage };
