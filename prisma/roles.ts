import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

export type RoleCreateInput = {
  name: string;
  description?: string;
  permissionIds: string[];
};

export type RoleUpdateInput = Partial<RoleCreateInput>;

/**
 * Creates a new role with a set of permissions.
 * @param data The data for the new role including permission IDs.
 * @returns The created role with its permissions.
 */
export async function createRole(data: RoleCreateInput) {
  const { permissionIds, ...roleData } = data;

  return prisma.role.create({
    data: {
      ...roleData,
      permissions: {
        create: permissionIds.map(permissionId => ({
          permissionId,
        })),
      },
    },
    include: {
      permissions: true,
    },
  });
}

/**
 * Retrieves all roles with a count of their permissions and users.
 * @returns A list of all roles.
 */
export async function getAllRoles() {
  return prisma.role.findMany({
    include: {
      _count: {
        select: { permissions: true, users: true },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });
}

/**
 * Retrieves a single role by its ID, including its permissions.
 * @param id The ID of the role to retrieve.
 * @returns The role with details, or null if not found.
 */
export async function getRoleById(id: string) {
  return prisma.role.findUnique({
    where: { id },
    include: {
      permissions: true,
    },
  });
}

/**
 * Updates an existing role and its permissions.
 * @param id The ID of the role to update.
 * @param data The data to update the role with.
 * @returns The updated role.
 */
export async function updateRole(id: string, data: RoleUpdateInput) {
  const { permissionIds, ...roleData } = data;

  return prisma.$transaction(async (tx) => {
    // 1. Update role details
    const updatedRole = await tx.role.update({
      where: { id },
      data: roleData,
    });

    // 2. If permissionIds are provided, update them
    if (permissionIds) {
      // Delete existing permissions for the role
      await tx.rolePermission.deleteMany({
        where: { roleId: id },
      });

      // Create new permissions for the role
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map(permissionId => ({
            roleId: id,
            permissionId,
          })),
        });
      }
    }

    return updatedRole;
  });
}

/**
 * Deletes a role.
 * @param id The ID of the role to delete.
 */
export async function deleteRole(id: string) {
  // The schema is set to cascade delete RolePermission entries,
  // so we only need to delete the role itself.
  return prisma.role.delete({
    where: { id },
  });
}

/**
 * Assigns a role to a user.
 * @param userId The ID of the user.
 * @param roleId The ID of the role to assign.
 * @returns The updated user.
 */
export async function assignRoleToUser(userId: string, roleId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { roleId },
  });
}