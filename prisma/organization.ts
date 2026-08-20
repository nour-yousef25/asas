import { PrismaClient, Organization } from "@prisma/client";

const prisma = new PrismaClient();

export type OrganizationAppearanceUpdateInput = Pick<
  Organization,
  'name' | 'logo' | 'primaryColor' | 'secondaryColor' | 'accentColor'
>;

/**
 * Retrieves the current organization's details.
 * Assumes a single organization exists in the database.
 * @returns The organization object or null if not found.
 */
export async function getOrganizationSettings() {
  // In a multi-tenant setup, you would filter by organizationId.
  // For a single organization setup, findFirst is sufficient.
  return prisma.organization.findFirst();
}

/**
 * Updates the appearance settings of the organization.
 * @param id The ID of the organization to update.
 * @param data The appearance data to update.
 * @returns The updated organization object.
 */
export async function updateOrganizationAppearance(
  id: string,
  data: Partial<OrganizationAppearanceUpdateInput>
) {
  return prisma.organization.update({
    where: { id },
    data,
  });
}