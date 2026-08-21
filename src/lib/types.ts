import { Role, MembershipStatus, PaymentStatus, DonationStatus, ProjectStatus, TaskStatus, TaskPriority, EventStatus, NewsStatus } from "@prisma/client";

export type { Role, MembershipStatus, PaymentStatus, DonationStatus, ProjectStatus, TaskStatus, TaskPriority, EventStatus, NewsStatus };

export interface UserSession {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: Role;
  avatar?: string | null;
}

export interface DashboardStats {
  totalMembers: number;
  totalDonations: number;
  totalDonationAmount: number;
  activeProjects: number;
  totalBeneficiaries: number;
  totalVolunteers: number;
}

export interface MemberWithUser {
  id: string;
  userId: string;
  membershipType: string;
  status: MembershipStatus;
  paymentStatus: PaymentStatus;
  membershipFee: number;
  paidAmount: number;
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
}

export interface DonationWithRelations {
  id: string;
  amount: number;
  paymentMethod: string;
  status: DonationStatus;
  isAnonymous: boolean;
  isGuest: boolean;
  guestName: string | null;
  guestPhone: string | null;
  createdAt: Date;
  donor: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  project: {
    title: string;
  } | null;
  campaign: {
    title: string;
  } | null;
  invoice: {
    invoiceNo: string;
    totalAmount: number;
    status: string;
  } | null;
}

export interface ProjectWithStats {
  id: string;
  title: string;
  description: string | null;
  targetAmount: number;
  collectedAmount: number;
  completionPercent: number;
  status: ProjectStatus;
  category: string | null;
  startDate: Date;
  endDate: Date | null;
  _count?: {
    donations: number;
  };
}

export interface BeneficiaryWithDocs {
  id: string;
  name: string;
  phone: string;
  nationalId: string | null;
  gender: string;
  status: string;
  familyMembers: number | null;
  needCategory: string | null;
  createdAt: Date;
  documents: {
    id: string;
    name: string;
    url: string;
    type: string;
  }[];
}

export interface TaskWithAssignee {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: Date | null;
  department: string | null;
  tags: string[];
  createdAt: Date;
  assignee: {
    id: string;
    name: string;
    avatar: string | null;
  };
  creator: {
    id: string;
    name: string;
  };
  _count?: {
    comments: number;
    attachments: number;
  };
}

export interface VolunteerWithStats {
  id: string;
  skills: string[];
  availability: string | null;
  totalHours: number;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    avatar: string | null;
  };
  _count?: {
    activities: number;
  };
}

export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  summary: string | null;
  imageUrl: string | null;
  category: string | null;
  status: NewsStatus;
  publishedAt: Date | null;
  createdAt: Date;
  author: {
    id: string;
    name: string;
  };
}

export interface Announcement {
  id: string;
  title: string;
  content: string | null;
  imageUrl: string | null;
  link: string | null;
  startDate: Date;
  endDate: Date | null;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface InvoiceData {
  id: string;
  invoiceNo: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  taxNumber: string;
  buyerName: string | null;
  buyerPhone: string | null;
  buyerEmail: string | null;
  status: string;
  createdAt: Date;
  donation: {
    id: string;
    amount: number;
    paymentMethod: string;
    donor: {
      name: string;
    } | null;
  };
}

export interface KPIWithRecords {
  id: string;
  title: string;
  description: string | null;
  unit: string;
  targetValue: number;
  frequency: string;
  strategicGoal: string | null;
  createdAt: Date;
  records: {
    id: string;
    period: string;
    actualValue: number;
    targetValue: number;
    notes: string | null;
    createdAt: Date;
  }[];
}

export interface EvaluationWithDetails {
  id: string;
  period: string;
  startDate: Date;
  endDate: Date | null;
  finalScore: number | null;
  status: string;
  createdAt: Date;
  employee: {
    id: string;
    name: string;
  };
  goals: {
    id: string;
    title: string;
    weight: number;
    score: number | null;
  }[];
  competencies: {
    id: string;
    title: string;
    weight: number;
    score: number | null;
  }[];
}
