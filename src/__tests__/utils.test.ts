import { slugify, generateRandomNumber, generateInvoiceNumber, isValidSaudiPhone, formatSaudiPhone, isValidSaudiId } from "@/lib/utils";

describe("slugify", () => {
  it("should convert text to slug", () => {
    expect(slugify(" Hello World ")).toBe("Hello-World");
  });

  it("should handle Arabic text", () => {
    expect(slugify("أخبار الجمعية")).toBe("أخبار-الجمعية");
  });

  it("should remove special characters", () => {
    expect(slugify("Hello! @World#")).toBe("Hello-World");
  });

  it("should handle multiple spaces", () => {
    expect(slugify("Hello   World")).toBe("Hello-World");
  });
});

describe("generateRandomNumber", () => {
  it("should generate number of specified length", () => {
    const num = generateRandomNumber(8);
    expect(num).toHaveLength(8);
    expect(/^\d{8}$/.test(num)).toBe(true);
  });

  it("should pad with zeros", () => {
    const num = generateRandomNumber(6);
    expect(num).toHaveLength(6);
  });
});

describe("generateInvoiceNumber", () => {
  it("should generate invoice number with year prefix", () => {
    const year = new Date().getFullYear();
    const invoice = generateInvoiceNumber();
    expect(invoice).toMatch(new RegExp(`^INV-${year}-\\d{8}$`));
  });
});

describe("isValidSaudiPhone", () => {
  it("should validate Saudi phone numbers", () => {
    expect(isValidSaudiPhone("0512345678")).toBe(true);
    expect(isValidSaudiPhone("+966512345678")).toBe(true);
    expect(isValidSaudiPhone("512345678")).toBe(true);
  });

  it("should reject invalid phone numbers", () => {
    expect(isValidSaudiPhone("1234567890")).toBe(false);
    expect(isValidSaudiPhone("051234567")).toBe(false);
    expect(isValidSaudiPhone("05123456789")).toBe(false);
    expect(isValidSaudiPhone("abcdefghij")).toBe(false);
  });
});

describe("formatSaudiPhone", () => {
  it("should format local phone to international", () => {
    expect(formatSaudiPhone("0512345678")).toBe("+966512345678");
  });

  it("should keep international format", () => {
    expect(formatSaudiPhone("+966512345678")).toBe("+966512345678");
  });
});

describe("isValidSaudiId", () => {
  it("should validate Saudi national ID", () => {
    expect(isValidSaudiId("1234567890")).toBe(true);
  });

  it("should reject invalid IDs", () => {
    expect(isValidSaudiId("2345678901")).toBe(false);
    expect(isValidSaudiId("123456789")).toBe(false);
    expect(isValidSaudiId("12345678901")).toBe(false);
    expect(isValidSaudiId("abcdefghij")).toBe(false);
  });
});
