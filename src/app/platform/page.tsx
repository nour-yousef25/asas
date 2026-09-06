import { Role } from "@prisma/client";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** حساب المنصة: لا ينتمي لأي جمعية ولا يمنح أي صلاحية مستأجر. */
export default async function PlatformPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== Role.SUPER_ADMIN) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-md rounded-lg border p-8 text-center space-y-4">
        <h1 className="text-xl font-bold">حساب إدارة المنصة</h1>
        <p className="text-sm text-muted-foreground">
          هذا الحساب مخصص لإدارة المنصة ولا ينتمي إلى أي جمعية، لذلك لا تتوفر له لوحة تحكم جمعية.
        </p>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="rounded-md border px-4 py-2 text-sm">
            تسجيل الخروج
          </button>
        </form>
      </div>
    </main>
  );
}
