export const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatar: true,
  role: true,
} as const;

export const userBasicSelect = {
  id: true,
  name: true,
} as const;

export const memberInclude = {
  user: {
    select: userSelect,
  },
} as const;

export const donationInclude = {
  donor: {
    select: {
      id: true,
      name: true,
      phone: true,
    },
  },
  project: {
    select: {
      id: true,
      title: true,
    },
  },
  campaign: {
    select: {
      id: true,
      title: true,
    },
  },
  invoice: {
    select: {
      id: true,
      invoiceNo: true,
      totalAmount: true,
      status: true,
    },
  },
} as const;

export const projectInclude = {
  _count: {
    select: {
      donations: true,
    },
  },
} as const;

export const beneficiaryInclude = {
  documents: {
    select: {
      id: true,
      name: true,
      url: true,
      type: true,
    },
  },
} as const;

export const taskInclude = {
  assignee: {
    select: {
      id: true,
      name: true,
      avatar: true,
    },
  },
  creator: {
    select: userBasicSelect,
  },
  _count: {
    select: {
      comments: true,
      attachments: true,
    },
  },
} as const;

export const volunteerInclude = {
  user: {
    select: userSelect,
  },
  _count: {
    select: {
      activities: true,
    },
  },
} as const;

export const newsInclude = {
  author: {
    select: userBasicSelect,
  },
} as const;

export const evaluationInclude = {
  employee: {
    select: userBasicSelect,
  },
  goals: {
    select: {
      id: true,
      title: true,
      weight: true,
      score: true,
    },
  },
  competencies: {
    select: {
      id: true,
      title: true,
      weight: true,
      score: true,
    },
  },
} as const;

export const kpiInclude = {
  records: {
    orderBy: { createdAt: "desc" as const },
    take: 12,
  },
} as const;
