import { getRoleById } from "@/modules/users/roles";
import { getAllPermissions } from "@/modules/users/permissions";
import { notFound } from "next/navigation";
import { RoleForm } from "../_components/role-form";

type EditRolePageProps = {
  params: {
    id: string;
  };
};

export default async function EditRolePage({ params }: EditRolePageProps) {
  const role = await getRoleById(params.id);

  if (!role) {
    notFound();
  }

  const allPermissions = await getAllPermissions();

  return (
    <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <RoleForm initialData={role} allPermissions={allPermissions} />
    </main>
  );
}