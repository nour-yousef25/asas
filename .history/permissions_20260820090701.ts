import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Retrieves all available permissions, grouped by module.
 * @returns An object where keys are module names and values are arrays of permissions.
 */
export async function getAllPermissions() {
  const permissions = await prisma.permission.findMany({
    orderBy: {
      module: 'asc',
    },
  });

  // Group permissions by module
  const groupedPermissions = permissions.reduce((acc, permission) => {
    const { module } = permission;
    if (!acc[module]) {
      acc[module] = [];
    }
    acc[module].push(permission);
    return acc;
  }, {} as Record<string, typeof permissions>);

  return groupedPermissions;
}

/**
 * Retrieves the permissions for a specific user.
 * @param userId The ID of the user.
 * @returns A list of permission names for the user.
 */
export async function getUserPermissions(userId: string) {
  const userPermissions = await prisma.userPermission.findMany({
    where: { userId },
    include: {
      permission: true,
    },
  });

  return userPermissions.map(up => up.permission.name);
}