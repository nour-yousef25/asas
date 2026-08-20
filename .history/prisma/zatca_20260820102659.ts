import { createHash } from 'crypto';
import qrcode from 'qrcode';
import { Organization, Donation } from '@prisma/client';

/**
 * Helper to format date/time for ZATCA TLV format.
 * YYYY-MM-DDTHH:mm:ssZ
 */
function formatZatcaDateTime(date: Date): string {
  return date.toISOString();
}

/**
 * Converts a string to a TLV (Tag-Length-Value) formatted buffer.
 * @param tag The tag number.
 * @param value The string value.
 * @returns A Buffer representing the TLV field.
 */
function toTlv(tag: number, value: string): Buffer {
  const tagBuffer = Buffer.from([tag]);
  const lengthBuffer = Buffer.from([Buffer.byteLength(value)]);
  const valueBuffer = Buffer.from(value);
  return Buffer.concat([tagBuffer, lengthBuffer, valueBuffer]);
}

/**
 * Generates a ZATCA-compliant QR code string (Base64).
 * @param organization The organization data.
 * @param donation The donation data.
 * @returns A Base64 encoded string for the QR code.
 */
export async function generateZatcaQrCode(
  organization: Pick<Organization, 'name' | 'taxNumber'>,
  donation: Pick<Donation, 'amount' | 'createdAt'>
) {
  // For simplified invoices, tax amount is 0.
  const totalWithVat = donation.amount.toFixed(2);
  const vatAmount = (0.0).toFixed(2);

  const tlvData = Buffer.concat([
    toTlv(1, organization.name),
    toTlv(2, organization.taxNumber || ''),
    toTlv(3, formatZatcaDateTime(donation.createdAt)),
    toTlv(4, totalWithVat),
    toTlv(5, vatAmount),
  ]);

  return tlvData.toString('base64');
}

/**
 * Generates a QR code image from the Base64 string.
 * @param base64Tlv The Base64 encoded TLV string.
 * @returns A data URL for the QR code image.
 */
export async function renderQrCode(base64Tlv: string): Promise<string> {
  try {
    return await qrcode.toDataURL(base64Tlv);
  } catch (err) {
    console.error('Failed to generate QR code image', err);
    throw new Error('Could not render QR code.');
  }
}

/**
 * Creates an invoice record in the database.
 * This function would be called after a donation is successfully processed.
 * @param prisma A Prisma client instance.
 * @param donation The completed donation object.
 * @param organization The organization details.
 */
export async function createInvoiceForDonation(
  prisma: any, // Pass prisma client as an argument
  donation: Donation,
  organization: Organization
) {
  const qrCodeString = await generateZatcaQrCode(organization, donation);

  return prisma.invoice.create({
    data: {
      invoiceNo: `INV-${donation.id.substring(0, 8)}`, // Simplified invoice number
      donationId: donation.id,
      amount: donation.amount,
      taxAmount: 0,
      totalAmount: donation.amount,
      taxNumber: organization.taxNumber || 'N/A',
      buyerName: donation.isGuest ? donation.guestName : 'متبرع مسجل',
      buyerPhone: donation.isGuest ? donation.guestPhone : '',
      status: 'PAID',
      issuedAt: donation.createdAt,
      pdfUrl: qrCodeString, // Storing the QR string here for now
    },
  });
}