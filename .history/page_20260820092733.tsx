import { PrismaClient } from "@prisma/client";
import { notFound } from "next/navigation";
import { getAllPermissions } from "@/modules/users/permissions";
import { PermissionsForm } from "./_components/permissions-form";

const prisma = new PrismaClient();

type UserPermissionsPageProps = {
  params: {
    id: string; // User ID
  };
};

export default async function UserPermissionsPage({ params }: UserPermissionsPageProps) {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
  });

  if (!user) {
    notFound();
  }

  // جلب جميع الصلاحيات المتاحة
  const allPermissions = await getAllPermissions();

  // جلب الصلاحيات الحالية للمستخدم
  const userPermissions = await prisma.userPermission.findMany({
    where: { userId: params.id },
    select: { permissionId: true },
  });
  const currentUserPermissionIds = userPermissions.map(p => p.permissionId);

  return (
    <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <PermissionsForm user={user} allPermissions={allPermissions} currentUserPermissionIds={currentUserPermissionIds} />
    </main>
  );
}