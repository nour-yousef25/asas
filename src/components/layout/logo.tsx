import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-primary to-secondary text-primary-foreground font-bold text-lg">
        أ
      </div>
      <div className="flex flex-col">
        <span className="font-bold text-base leading-tight">أساس</span>
        <span className="text-xs text-muted-foreground leading-tight">إدارة الجمعيات الخيرية</span>
      </div>
    </Link>
  );
}
