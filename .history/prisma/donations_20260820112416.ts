import { PrismaClient, Donation, DonationStatus } from "@prisma/client";
import { createInvoiceForDonation } from "../integrations/zatca";
import { sendSms } from "../integrations/sms";

const prisma = new PrismaClient();

export type DonationCreateInput = Omit<Donation, 'id' | 'createdAt' | 'updatedAt' | 'status'>;

/**
 * Creates a new donation, updates donor stats, and generates a ZATCA-compliant invoice.
 * This entire process is transactional.
 * @param data The data for the new donation.
 * @returns The created donation object.
 */
export async function createDonation(data: DonationCreateInput) {
  const { donorId, amount, guestPhone, ...donationData } = data;

  const newDonation = await prisma.$transaction(async (tx) => {
    // 1. Fetch organization details (needed for the invoice)
    const organization = await tx.organization.findFirst();
    if (!organization) {
      throw new Error("Organization details not found. Cannot create invoice.");
    }

    // 2. Create the donation record
    const createdDonation = await tx.donation.create({
      data: {
        ...donationData,
        donorId,
        amount,
        guestPhone,
        status: DonationStatus.COMPLETED, // Assume payment is completed for now
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
    await createInvoiceForDonation(tx, createdDonation, organization);

    return createdDonation;
  });

  // 5. Send a thank you SMS (Side-effect, outside the transaction)
  const phone = guestPhone; // In a real scenario, you'd also fetch the phone of a registered donor.
  if (phone) {
    try {
      await sendSms({
        to: phone,
        message: `شكراً لتبرعكم بمبلغ ${amount} ريال لصالح جمعية أساس. رقم الفاتورة: INV-${newDonation.id.substring(0, 8)}`,
      });
    } catch (smsError) {
      // Log the error, but don't fail the whole operation because of it.
      console.error(`Failed to send thank you SMS for donation ${newDonation.id}:`, smsError);
    }
  }

  return newDonation;
}