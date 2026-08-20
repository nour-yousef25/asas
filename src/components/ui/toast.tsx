"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

const ToastContext = React.createContext<{
  toasts: Toast[];
  addToast: (t: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const addToast = React.useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 5000);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 no-print">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-lg p-4 shadow-lg min-w-[300px] max-w-md text-sm animate-slide-in-right",
              t.type === "success" && "bg-success text-success-foreground",
              t.type === "error" && "bg-danger text-danger-foreground",
              t.type === "warning" && "bg-warning text-warning-foreground",
              t.type === "info" && "bg-primary text-primary-foreground",
            )}
          >
            <div className="font-medium">{t.title}</div>
            {t.description && <div className="mt-1 opacity-90">{t.description}</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
