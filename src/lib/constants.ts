// وحدات النظام للتحكم في الصلاحيات
export const MODULES = {
  DASHBOARD: "dashboard",
  NEWS: "news",
  GALLERY: "gallery",
  CONTENT: "content",
  ANNOUNCEMENTS: "announcements",
  MEMBERS: "members",
  VOLUNTEERS: "volunteers",
  BENEFICIARIES: "beneficiaries",
  DONATIONS: "donations",
  DONORS: "donors",
  PROJECTS: "projects",
  EVENTS: "events",
  TASKS: "tasks",
  SURVEYS: "surveys",
  PERFORMANCE: "performance",
  KPI: "kpi",
  EVALUATIONS: "evaluations",
  STORE: "store",
  FINANCE: "finance",
  REPORTS: "reports",
  SMS: "sms",
  NOTIFICATIONS: "notifications",
  ORGANIZATION: "organization",
  USERS: "users",
  SETTINGS: "settings",
  TRIAL: "trial",
} as const;

// إجراءات الصلاحيات
export const ACTIONS = {
  CREATE: "create",
  READ: "read",
  UPDATE: "update",
  DELETE: "delete",
  EXPORT: "export",
  PRINT: "print",
} as const;

// خريطة وحدات النظام مع الأيقونات والعناوين
export const MODULE_LABELS: Record<string, { title: string; icon: string }> = {
  dashboard: { title: "لوحة التحكم", icon: "LayoutDashboard" },
  news: { title: "الأخبار", icon: "Newspaper" },
  gallery: { title: "مكتبة الصور والفيديو", icon: "Image" },
  content: { title: "الأنظمة والتعليمات", icon: "FileText" },
  announcements: { title: "الإعلانات", icon: "Megaphone" },
  members: { title: "الأعضاء", icon: "Users" },
  volunteers: { title: "المتطوعون", icon: "HeartHandshake" },
  beneficiaries: { title: "المستفيدون", icon: "UsersRound" },
  donations: { title: "التبرعات", icon: "HandCoins" },
  donors: { title: "المانحون", icon: "HandHeart" },
  projects: { title: "المشاريع", icon: "FolderKanban" },
  events: { title: "الفعاليات", icon: "Calendar" },
  tasks: { title: "المهام", icon: "ListTodo" },
  surveys: { title: "الاستبيانات", icon: "ClipboardList" },
  performance: { title: "الأداء", icon: "TrendingUp" },
  kpi: { title: "مؤشرات الأداء", icon: "Gauge" },
  evaluations: { title: "تقييمات الموظفين", icon: "Star" },
  store: { title: "المتجر", icon: "ShoppingCart" },
  finance: { title: "المالية", icon: "Wallet" },
  reports: { title: "التقارير", icon: "BarChart3" },
  sms: { title: "رسائل SMS", icon: "MessageSquare" },
  notifications: { title: "الإشعارات", icon: "Bell" },
  organization: { title: "الجمعية", icon: "Building2" },
  users: { title: "المستخدمون", icon: "UserCog" },
  settings: { title: "الإعدادات", icon: "Settings" },
  trial: { title: "طلبات التجربة", icon: "FlaskConical" },
};

// ترتيب وحدات القائمة الجانبية
export const SIDEBAR_MENU = [
  { key: "dashboard", label: "لوحة التحكم", icon: "LayoutDashboard", url: "/" },
  {
    key: "content-section",
    label: "المحتوى",
    isSection: true,
    children: [
      { key: "news", label: "الأخبار", icon: "Newspaper", url: "/news" },
      { key: "gallery", label: "مكتبة الصور والفيديو", icon: "Image", url: "/gallery" },
      { key: "content", label: "الأنظمة والتعليمات", icon: "FileText", url: "/content" },
      { key: "announcements", label: "الإعلانات", icon: "Megaphone", url: "/announcements" },
    ],
  },
  {
    key: "community-section",
    label: "المجتمع",
    isSection: true,
    children: [
      { key: "members", label: "الأعضاء", icon: "Users", url: "/members" },
      { key: "volunteers", label: "المتطوعون", icon: "HeartHandshake", url: "/volunteers" },
      { key: "beneficiaries", label: "المستفيدون", icon: "UsersRound", url: "/beneficiaries" },
      { key: "donors", label: "المانحون", icon: "HandHeart", url: "/donors" },
    ],
  },
  {
    key: "finance-section",
    label: "المالية والتبرعات",
    isSection: true,
    children: [
      { key: "donations", label: "التبرعات", icon: "HandCoins", url: "/donations" },
      { key: "projects", label: "المشاريع", icon: "FolderKanban", url: "/projects" },
      { key: "finance", label: "الشؤون المالية", icon: "Wallet", url: "/finance" },
      { key: "store", label: "المتجر", icon: "ShoppingCart", url: "/store" },
    ],
  },
  {
    key: "operations-section",
    label: "العمليات",
    isSection: true,
    children: [
      { key: "events", label: "الفعاليات", icon: "Calendar", url: "/events" },
      { key: "tasks", label: "المهام", icon: "ListTodo", url: "/tasks" },
      { key: "surveys", label: "الاستبيانات", icon: "ClipboardList", url: "/surveys" },
    ],
  },
  {
    key: "performance-section",
    label: "الأداء والتقييم",
    isSection: true,
    children: [
      { key: "kpi", label: "مؤشرات الأداء", icon: "Gauge", url: "/performance/kpi" },
      { key: "evaluations", label: "تقييمات الموظفين", icon: "Star", url: "/performance/evaluations" },
      { key: "reports", label: "التقارير", icon: "BarChart3", url: "/reports" },
    ],
  },
  {
    key: "admin-section",
    label: "الإدارة",
    isSection: true,
    children: [
      { key: "organization", label: "الجمعية", icon: "Building2", url: "/organization" },
      { key: "users", label: "المستخدمون", icon: "UserCog", url: "/users" },
      { key: "sms", label: "رسائل SMS", icon: "MessageSquare", url: "/sms" },
      { key: "settings", label: "الإعدادات", icon: "Settings", url: "/settings" },
    ],
  },
];

// ألوان افتراضية
export const DEFAULT_COLORS = {
  primary: "#0D9488",
  secondary: "#115E59",
  accent: "#F59E0B",
};
