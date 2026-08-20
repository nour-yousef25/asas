import { loginSchema, registerSchema, donationSchema, beneficiarySchema, taskSchema, projectSchema } from "@/lib/validations";

describe("loginSchema", () => {
  it("should validate correct login data", () => {
    const result = loginSchema.safeParse({
      identifier: "admin@asas.sa",
      password: "admin123",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty identifier", () => {
    const result = loginSchema.safeParse({
      identifier: "",
      password: "admin123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject short password", () => {
    const result = loginSchema.safeParse({
      identifier: "admin@asas.sa",
      password: "12345",
    });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("should validate correct registration data", () => {
    const result = registerSchema.safeParse({
      name: "أحمد محمد",
      phone: "0512345678",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid phone", () => {
    const result = registerSchema.safeParse({
      name: "أحمد",
      phone: "1234567890",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject short name", () => {
    const result = registerSchema.safeParse({
      name: "أ",
      phone: "0512345678",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });
});

describe("donationSchema", () => {
  it("should validate correct donation", () => {
    const result = donationSchema.safeParse({
      amount: 100,
      paymentMethod: "mada",
    });
    expect(result.success).toBe(true);
  });

  it("should reject zero amount", () => {
    const result = donationSchema.safeParse({
      amount: 0,
      paymentMethod: "mada",
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative amount", () => {
    const result = donationSchema.safeParse({
      amount: -100,
      paymentMethod: "mada",
    });
    expect(result.success).toBe(false);
  });
});

describe("beneficiarySchema", () => {
  it("should validate correct beneficiary", () => {
    const result = beneficiarySchema.safeParse({
      name: "محمد أحمد",
      phone: "0512345678",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing name", () => {
    const result = beneficiarySchema.safeParse({
      phone: "0512345678",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid phone", () => {
    const result = beneficiarySchema.safeParse({
      name: "محمد",
      phone: "123",
    });
    expect(result.success).toBe(false);
  });
});

describe("taskSchema", () => {
  it("should validate correct task", () => {
    const result = taskSchema.safeParse({
      title: "مهمة جديدة",
      assigneeId: "user-123",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty title", () => {
    const result = taskSchema.safeParse({
      title: "",
      assigneeId: "user-123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing assignee", () => {
    const result = taskSchema.safeParse({
      title: "مهمة جديدة",
    });
    expect(result.success).toBe(false);
  });
});

describe("projectSchema", () => {
  it("should validate correct project", () => {
    const result = projectSchema.safeParse({
      title: "مشروع جديد",
      targetAmount: 100000,
      startDate: new Date(),
    });
    expect(result.success).toBe(true);
  });

  it("should reject negative target amount", () => {
    const result = projectSchema.safeParse({
      title: "مشروع",
      targetAmount: -100,
      startDate: new Date(),
    });
    expect(result.success).toBe(false);
  });
});
