"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Modal = React.forwardRef<HTMLDivElement, {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
}>(({ open, onClose, children, title, description, className }, ref) => {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 animate-fade-in" />
      <div
        className={cn(
          "relative w-full max-w-lg rounded-lg bg-card shadow-lg animate-scale-in",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || description) && (
          <div className="border-b p-6 pb-4">
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
});
Modal.displayName = "Modal";

export { Modal };
