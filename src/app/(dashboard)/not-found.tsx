export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
        <h2 className="text-2xl font-bold">الصفحة غير موجودة</h2>
        <p className="text-muted-foreground">الصفحة التي تبحث عنها غير موجودة في لوحة التحكم</p>
        <a
          href="/"
          className="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          العودة للرئيسية
        </a>
      </div>
    </div>
  );
}
