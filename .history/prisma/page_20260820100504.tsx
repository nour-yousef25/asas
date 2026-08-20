import { getAllPermissions } from "@/modules/users/permissions";
import { RoleForm } from "./_components/role-form";

export default async function NewRolePage() {
  // جلب جميع الصلاحيات المتاحة لعرضها في النموذج
  const allPermissions = await getAllPermissions();

  return (
    <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <RoleForm allPermissions={allPermissions} />
    </main>
  );
}