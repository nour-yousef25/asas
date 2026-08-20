"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-destructive">حدث خطأ</h2>
        <p className="text-muted-foreground">{error.message || "حدث خطأ غير متوقع"}</p>
        <Button onClick={reset}>حاول مرة أخرى</Button>
      </div>
    </div>
  );
}
