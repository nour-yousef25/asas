export default function PublicNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
        <h2 className="text-2xl font-bold">الصفحة غير موجودة</h2>
        <p className="text-muted-foreground">الصفحة التي تبحث عنها غير موجودة أو تم نقلها</p>
        <div className="flex gap-2 justify-center">
          <a
            href="/"
            className="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            العودة للرئيسية
          </a>
          <a
            href="/donate"
            className="inline-block rounded-md border border-primary px-4 py-2 text-primary hover:bg-primary/10"
          >
            تبرع الآن
          </a>
        </div>
      </div>
    </div>
  );
}
