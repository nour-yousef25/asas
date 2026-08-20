"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const DropdownMenu = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative inline-block" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<any>, { open, setOpen })
          : child
      )}
    </div>
  );
};

const DropdownMenuTrigger = ({ children, asChild, open, setOpen }: any) => {
  const child = asChild ? React.Children.only(children) : <button>{children}</button>;
  return React.cloneElement(child, { onClick: () => setOpen(!open) });
};

const DropdownMenuContent = ({ children, align = "end", open }: any) => {
  if (!open) return null;
  return (
    <div className={cn(
      "absolute z-50 mt-1 min-w-[8rem] rounded-md border bg-popover p-1 shadow-md",
      align === "end" ? "left-0" : "right-0"
    )}>
      {children}
    </div>
  );
};

const DropdownMenuLabel = ({ children, className }: any) => (
  <div className={cn("px-2 py-1.5 text-sm font-semibold text-muted-foreground", className)}>{children}</div>
);

const DropdownMenuSeparator = () => <div className="my-1 h-px bg-border" />;

const DropdownMenuItem = ({ children, className, onClick, asChild }: any) => {
  if (asChild) {
    return (
      <div className={cn("flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-muted", className)}>
        {children}
      </div>
    );
  }
  return (
    <button
      onClick={onClick}
      className={cn("flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-muted", className)}
    >
      {children}
    </button>
  );
};

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem };
