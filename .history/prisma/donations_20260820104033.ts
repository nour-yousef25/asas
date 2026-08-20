import { PrismaClient, Donation, DonationStatus } from "@prisma/client";
import { createInvoiceForDonation } from "../integrations/zatca";

const prisma = new PrismaClient();

export type DonationCreateInput = Omit<Donation, 'id' | 'createdAt' | 'updatedAt' | 'status'>;

/**
 * Creates a new donation, updates donor stats, and generates a ZATCA-compliant invoice.
 * This entire process is transactional.
 * @param data The data for the new donation.
 * @returns The created donation object.
 */
export async function createDonation(data: DonationCreateInput) {
  const { donorId, amount, ...donationData } = data;

  return prisma.$transaction(async (tx) => {
    // 1. Fetch organization details (needed for the invoice)
    const organization = await tx.organization.findFirst();
    if (!organization) {
      throw new Error("Organization details not found. Cannot create invoice.");
    }

    // 2. Create the donation record
    const newDonation = await tx.donation.create({
      data: {
        ...donationData,
        donorId,
        amount,
        status: DonationStatus.COMPLETED, // Assume payment is completed
      },
    });

    // 3. If the donation is from a registered donor, update their stats
    if (donorId) {
      await tx.donor.update({
        where: { id: donorId },
        data: {
          totalDonations: {
            increment: amount,
          },
          lastDonationAt: new Date(),
        },
      });
    }

    // 4. Create the corresponding electronic invoice
    await createInvoiceForDonation(tx, newDonation, organization);

    return newDonation;
  });
}