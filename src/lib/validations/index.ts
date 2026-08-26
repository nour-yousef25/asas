import { z } from "zod";

export const passwordPolicySchema = z.string()
  .min(12, "كلمة المرور يجب أن تتكون من 12 حرفاً على الأقل")
  .max(4_096)
  .regex(/[a-z]/, "كلمة المرور يجب أن تحتوي حرفاً صغيراً")
  .regex(/[A-Z]/, "كلمة المرور يجب أن تحتوي حرفاً كبيراً")
  .regex(/[0-9]/, "كلمة المرور يجب أن تحتوي رقماً");

// ===== المستخدمون =====
export const loginSchema = z.object({
  identifier: z.string().min(1, "البريد أو الجوال مطلوب"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب").max(100),
  email: z.string().email("البريد الإلكتروني غير صحيح").optional().or(z.literal("")),
  phone: z.string().regex(/^(\+966|0)?5\d{8}$/, "رقم الجوال غير صحيح"),
  password: passwordPolicySchema,
  nationalId: z.string().regex(/^\d{10}$/, "رقم الهوية يجب أن يكون 10 أرقام").optional().or(z.literal("")),
});

export const userSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  email: z.string().email("البريد غير صحيح").optional().or(z.literal("")),
  phone: z.string().optional(),
  role: z.enum([
    "SUPER_ADMIN",
    "ADMIN",
    "EDITOR",
    "MEMBER",
    "DONOR",
    "VOLUNTEER",
    "BENEFICIARY",
    "EMPLOYEE",
  ]),
  isActive: z.boolean().default(true),
});

// ===== الأخبار =====
export const newsSchema = z.object({
  title: z.string().min(2, "العنوان مطلوب"),
  content: z.string().min(10, "المحتوى مطلوب"),
  summary: z.string().optional(),
  imageUrl: z.string().url("رابط الصورة غير صحيح").optional().or(z.literal("")),
  category: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  publishedAt: z.coerce.date().optional(),
});

// ===== المشاريع =====
export const projectSchema = z.object({
  title: z.string().min(2, "العنوان مطلوب"),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  targetAmount: z.coerce.number().min(0, "المبلغ يجب أن يكون أكبر من صفر"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  status: z.enum(["PLANNING", "ACTIVE", "COMPLETED", "SUSPENDED", "CANCELLED"]).default("PLANNING"),
  category: z.string().optional(),
  location: z.string().optional(),
});

// ===== التبرعات =====
export const donationSchema = z.object({
  amount: z.coerce.number().min(1, "المبلغ مطلوب"),
  paymentMethod: z.string().min(1, "طريقة الدفع مطلوبة"),
  campaignId: z.string().optional(),
  projectId: z.string().optional(),
  donorId: z.string().optional(),
  isAnonymous: z.boolean().default(false),
  isGuest: z.boolean().default(false),
  guestName: z.string().optional(),
  guestPhone: z.string().optional(),
  guestEmail: z.string().email("البريد غير صحيح").optional().or(z.literal("")),
});

// ===== الأعضاء =====
export const memberSchema = z.object({
  userId: z.string().min(1),
  membershipType: z.enum(["FOUNDER", "REGULAR", "HONORARY", "ASSOCIATE"]).default("REGULAR"),
  membershipFee: z.coerce.number().min(0).default(0),
  paidAmount: z.coerce.number().min(0).default(0),
  endDate: z.coerce.date().optional(),
});

// ===== المستفيدون =====
export const beneficiarySchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  nationalId: z.string().regex(/^\d{10}$/).optional().or(z.literal("")),
  phone: z.string().regex(/^(\+966|0)?5\d{8}$/, "رقم الجوال غير صحيح"),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE"]).default("MALE"),
  dateOfBirth: z.coerce.date().optional(),
  familyMembers: z.coerce.number().int().min(0).optional(),
  incomeLevel: z.string().optional(),
  needCategory: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "COMPLETED"]).default("ACTIVE"),
  notes: z.string().optional(),
});

// ===== الفعاليات =====
export const eventSchema = z.object({
  title: z.string().min(2, "العنوان مطلوب"),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  location: z.string().optional(),
  capacity: z.coerce.number().int().min(0).optional(),
});

// ===== المهام =====
export const taskSchema = z.object({
  title: z.string().min(2, "العنوان مطلوب"),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE", "CANCELLED"]).default("TODO"),
  dueDate: z.coerce.date().optional(),
  assigneeId: z.string().min(1, "المسؤول مطلوب"),
  department: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const taskCommentSchema = z.object({
  content: z.string().min(1, "التعليق مطلوب"),
});

// ===== الاستبيانات =====
export const surveySchema = z.object({
  title: z.string().min(2, "العنوان مطلوب"),
  description: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isPublic: z.boolean().default(false),
});

export const surveyQuestionSchema = z.object({
  question: z.string().min(2, "السؤال مطلوب"),
  type: z.enum(["text", "single_choice", "multiple_choice", "rating", "scale"]),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(false),
});

// ===== KPI =====
export const kpiSchema = z.object({
  title: z.string().min(2, "العنوان مطلوب"),
  description: z.string().optional(),
  targetEntity: z.enum(["DEPARTMENT", "PROJECT", "EMPLOYEE"]),
  targetId: z.string().optional(),
  unit: z.string().min(1, "الوحدة مطلوبة"),
  targetValue: z.coerce.number(),
  strategicGoal: z.string().optional(),
  frequency: z.enum(["monthly", "quarterly", "yearly"]).default("monthly"),
});

export const kpiRecordSchema = z.object({
  kpiId: z.string().min(1),
  period: z.string().min(1, "الفترة مطلوبة"),
  actualValue: z.coerce.number(),
  targetValue: z.coerce.number(),
  notes: z.string().optional(),
});

// ===== التقييمات =====
export const evaluationSchema = z.object({
  employeeId: z.string().min(1, "الموظف مطلوب"),
  period: z.string().min(1, "الفترة مطلوبة"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});

export const evaluationGoalSchema = z.object({
  title: z.string().min(2, "العنوان مطلوب"),
  description: z.string().optional(),
  weight: z.coerce.number().min(0).max(100, "النسبة يجب أن تكون بين 0 و 100"),
  score: z.coerce.number().min(0).max(100).optional(),
});

export const evaluationCompetencySchema = z.object({
  title: z.string().min(2, "العنوان مطلوب"),
  description: z.string().optional(),
  weight: z.coerce.number().min(0).max(100, "النسبة يجب أن تكون بين 0 و 100"),
  score: z.coerce.number().min(0).max(100).optional(),
});

// ===== المتجر =====
export const productSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "السعر يجب أن يكون أكبر من صفر"),
  stock: z.coerce.number().int().min(0).default(0),
  imageUrl: z.string().url().optional().or(z.literal("")),
  isDigital: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

// ===== الإعلانات =====
export const announcementSchema = z.object({
  title: z.string().min(2, "العنوان مطلوب"),
  content: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  link: z.string().url().optional().or(z.literal("")),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

// ===== حملات التبرع =====
export const campaignSchema = z.object({
  title: z.string().min(2, "العنوان مطلوب"),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  targetAmount: z.coerce.number().min(1, "المبلغ المستهدف مطلوب"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]).default("ACTIVE"),
});

// ===== قوالب SMS =====
export const smsTemplateSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  content: z.string().min(1, "المحتوى مطلوب"),
  category: z.string().min(1, "الفئة مطلوبة"),
  isActive: z.boolean().default(true),
});

export const smsSendSchema = z.object({
  phones: z.array(z.string()).min(1, "رقام واحد على الأقل"),
  message: z.string().min(1, "الرسالة مطلوبة"),
  templateId: z.string().optional(),
});

// ===== الجمعية =====
export const organizationSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  nameEn: z.string().optional(),
  description: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  registrationNo: z.string().optional(),
  ncnpRef: z.string().optional(),
  taxNumber: z.string().optional(),
  logo: z.string().optional(),
  foundedDate: z.coerce.date().optional(),
});

// ===== طلب تجربة =====
export const trialRequestSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  email: z.string().email("البريد غير صحيح"),
  phone: z.string().regex(/^(\+966|0)?5\d{8}$/, "رقم الجوال غير صحيح"),
  orgName: z.string().optional(),
  message: z.string().optional(),
});
