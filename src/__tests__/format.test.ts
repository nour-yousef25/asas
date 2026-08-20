import { formatCurrency, formatNumber, formatPercent, formatDate, formatDateTime, formatDateShort, timeAgo, truncate, getFirstName } from "@/lib/format";

describe("formatCurrency", () => {
  it("should format amount as SAR", () => {
    const result = formatCurrency(1234.56);
    expect(result).toContain("١٬٢٣٤");
    expect(result).toContain("٥٦");
  });

  it("should handle zero", () => {
    const result = formatCurrency(0);
    expect(result).toContain("٠");
  });
});

describe("formatNumber", () => {
  it("should format number in Arabic", () => {
    const result = formatNumber(1234567);
    expect(result).toContain("١٬٢٣٤٬٥٦٧");
  });
});

describe("formatPercent", () => {
  it("should format as percentage", () => {
    const result = formatPercent(75);
    expect(result).toContain("٧٥");
    expect(result).toContain("%");
  });
});

describe("formatDate", () => {
  it("should format date in Arabic", () => {
    const date = new Date("2024-01-15");
    const result = formatDate(date);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("should handle string dates", () => {
    const result = formatDate("2024-01-15");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });
});

describe("truncate", () => {
  it("should truncate long text", () => {
    expect(truncate("Hello World", 5)).toBe("Hello...");
  });

  it("should not truncate short text", () => {
    expect(truncate("Hi", 5)).toBe("Hi");
  });
});

describe("getFirstName", () => {
  it("should extract first name", () => {
    expect(getFirstName("أحمد محمد علي")).toBe("أحمد");
  });

  it("should handle single name", () => {
    expect(getFirstName("أحمد")).toBe("أحمد");
  });
});
