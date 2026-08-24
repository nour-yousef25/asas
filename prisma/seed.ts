import { PrismaClient, Role, NewsStatus, MembershipType, MembershipStatus, DonationStatus, ProjectStatus, CampaignStatus, TaskStatus, TaskPriority, EventStatus, SurveyStatus, KPIStatus, KPITargetEntity, EvaluationStatus, DonorType, DonorStatus, VolunteerStatus, BeneficiaryStatus, Gender, PaymentStatus, MeetingStatus, AttendanceStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { W02_PERMISSION_CATALOG } from "../src/lib/permission-catalog";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 بدء بذر البيانات التجريبية...");

  await Promise.all(W02_PERMISSION_CATALOG.map(([name, module, action]) => prisma.permission.upsert({
    where: { name },
    update: { module, action },
    create: { name, module, action, description: `W02 semantic permission: ${name}` },
  })));

  // تنظيف البيانات بالترتيب الصحيح (الأبناء قبل الآباء)
  await prisma.userPermission.deleteMany();
  await prisma.taskAttachment.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.news.deleteMany();
  await prisma.surveyAnswer.deleteMany();
  await prisma.surveyResponse.deleteMany();
  await prisma.surveyQuestion.deleteMany();
  await prisma.survey.deleteMany();
  await prisma.kPIRecord.deleteMany();
  await prisma.kPI.deleteMany();
  await prisma.evaluationGoal.deleteMany();
  await prisma.evaluationCompetency.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.document.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.photoAlbum.deleteMany();
  await prisma.video.deleteMany();
  await prisma.videoCategory.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.contentPage.deleteMany();
  await prisma.eventAttendance.deleteMany();
  await prisma.event.deleteMany();
  await prisma.membershipPayment.deleteMany();
  await prisma.member.deleteMany();
  await prisma.volunteerActivity.deleteMany();
  await prisma.volunteer.deleteMany();
  await prisma.beneficiaryDocument.deleteMany();
  await prisma.beneficiary.deleteMany();
  await prisma.donorCommunication.deleteMany();
  await prisma.recurringDonation.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.donation.deleteMany();
  await prisma.donationCampaign.deleteMany();
  await prisma.project.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.sMSLog.deleteMany();
  await prisma.sMSTemplate.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.storeOrder.deleteMany();
  await prisma.storeProduct.deleteMany();
  await prisma.boardMember.deleteMany();
  await prisma.assemblyMeeting.deleteMany();
  await prisma.siteSetting.deleteMany();
  await prisma.financialAccount.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.user.deleteMany();

  // ===== المستخدمون =====
  const passwordHash = await bcrypt.hash("admin123", 10);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@asas.sa" },
    update: {},
    create: {
      name: "مدير النظام",
      email: "admin@asas.sa",
      phone: "0512345678",
      password: passwordHash,
      nationalId: "1001234567",
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  });

  const editorUser = await prisma.user.upsert({
    where: { email: "editor@asas.sa" },
    update: {},
    create: {
      name: "محرر المحتوى",
      email: "editor@asas.sa",
      phone: "0512345679",
      password: passwordHash,
      role: Role.EDITOR,
      isActive: true,
    },
  });

  // ===== الجمعية =====
  const organization = await prisma.organization.create({
    data: {
      name: "جمعية أساس الخيرية",
      nameEn: "Asas Charity Foundation",
      description: "جمعية خيرية سعودية تهدف إلى مساعدة المحتاجين والفئات الأقل حظاً من المجتمع",
      phone: "0112345678",
      email: "info@asas.sa",
      website: "https://asas.sa",
      address: "الرياض - حي العليا",
      city: "الرياض",
      registrationNo: "1234",
      ncnpRef: "NCNP-2024-001",
      taxNumber: "300123456789000",
      foundedDate: new Date("2020-01-01"),
    },
  });

  await prisma.organizationMembership.createMany({
    data: [
      { organizationId: organization.id, userId: adminUser.id, role: Role.SUPER_ADMIN, isDefault: true },
      { organizationId: organization.id, userId: editorUser.id, role: Role.EDITOR, isDefault: true },
    ],
  });
  await prisma.user.updateMany({
    where: { id: { in: [adminUser.id, editorUser.id] } },
    data: { activeOrganizationId: organization.id },
  });
  const [adminMembership, editorMembership] = await Promise.all([
    prisma.organizationMembership.findUniqueOrThrow({ where: { organizationId_userId: { organizationId: organization.id, userId: adminUser.id } } }),
    prisma.organizationMembership.findUniqueOrThrow({ where: { organizationId_userId: { organizationId: organization.id, userId: editorUser.id } } }),
  ]);
  const [adminRole, editorRole] = await Promise.all([
    prisma.organizationRole.create({ data: { organizationId: organization.id, name: "ORG_ADMIN", isSystem: true } }),
    prisma.organizationRole.create({ data: { organizationId: organization.id, name: "CONTENT_EDITOR", isSystem: true } }),
  ]);
  const rolePermissions = {
    ORG_ADMIN: ["identity.membership.read", "identity.membership.manage", "identity.role.manage", "audit.read", "settings.read", "settings.manage", "support.access.approve", "support.access.revoke", "report.generate", "report.export", "communications.publication.schedule"],
    CONTENT_EDITOR: ["settings.read", "report.generate"],
  } as const;
  const seededPermissions = await prisma.permission.findMany({ where: { name: { in: [...rolePermissions.ORG_ADMIN, ...rolePermissions.CONTENT_EDITOR] } } });
  const permissionIds = new Map(seededPermissions.map((permission) => [permission.name, permission.id]));
  const permissionId = (name: string) => {
    const id = permissionIds.get(name);
    if (!id) throw new Error(`Missing seeded permission: ${name}`);
    return id;
  };
  await prisma.organizationRolePermission.createMany({
    data: [
      ...rolePermissions.ORG_ADMIN.map((name) => ({ organizationRoleId: adminRole.id, permissionId: permissionId(name) })),
      ...rolePermissions.CONTENT_EDITOR.map((name) => ({ organizationRoleId: editorRole.id, permissionId: permissionId(name) })),
    ],
  });
  await prisma.membershipRole.createMany({
    data: [
      { membershipId: adminMembership.id, organizationRoleId: adminRole.id },
      { membershipId: editorMembership.id, organizationRoleId: editorRole.id },
    ],
  });
  await prisma.organizationMembership.updateMany({
    where: { id: { in: [adminMembership.id, editorMembership.id] } },
    data: { policyVersion: { increment: 1 } },
  });

  // ===== أعضاء مجلس الإدارة =====
  await prisma.boardMember.create({
    data: {
      organizationId: organization.id,
      userId: adminUser.id,
      name: "مدير النظام",
      position: "رئيس مجلس الإدارة",
      startDate: new Date("2024-01-01"),
    },
  });

  // ===== الأخبار =====
  const newsData = [
    { title: "افتتاح مركز أساس للتأهيل", content: "افتتحت جمعية أساس الخيرية مركزها الجديد لتأهيل الأيتام...", category: "أنشطة" },
    { title: "حملة إفطار صائم ٢٠٢٦", content: "ضمن أنشطتها الرمضانية، أطلقت الجمعية حملة إفطار صائم...", category: "حملات" },
    { title: "شراكة مع وزارة الموارد البشرية", content: "وقعت الجمعية اتفاقية شراكة مع وزارة الموارد...", category: "إعلانات" },
    { title: "كفالة ١٠٠ يتيم جديد", content: "أعلنت الجمعية عن فتح باب كفالة ١٠٠ يتيم جديد...", category: "أخبار" },
  ];
  for (const n of newsData) {
    await prisma.news.create({
      data: {
        ...n,
        slug: n.title.replace(/\s+/g, "-"),
        summary: n.content.slice(0, 100),
        authorId: adminUser.id,
        status: NewsStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
  }

  // ===== حملات التبرع =====
  const campaign1 = await prisma.donationCampaign.create({
    data: {
      title: "كفالة يتيم",
      description: "ساهم في كفالة الأيتام وتوفير احتياجاتهم",
      targetAmount: 500000,
      collectedAmount: 425000,
      startDate: new Date("2025-01-01"),
      status: CampaignStatus.ACTIVE,
    },
  });

  const campaign2 = await prisma.donationCampaign.create({
    data: {
      title: "إفطار صائم",
      description: "توفير وجبات إفطار للصائمين في رمضان",
      targetAmount: 200000,
      collectedAmount: 175000,
      startDate: new Date("2025-02-01"),
      status: CampaignStatus.ACTIVE,
    },
  });

  // ===== المشاريع =====
  const project1 = await prisma.project.create({
    data: {
      title: "كفالة ١٠٠ يتيم",
      description: "كفالة ١٠٠ يتيم وتوفير احتياجاتهم المعيشية والتعليمية",
      targetAmount: 500000,
      collectedAmount: 425000,
      completionPercent: 85,
      startDate: new Date("2025-01-01"),
      status: ProjectStatus.ACTIVE,
      category: "كفالة",
      creatorId: adminUser.id,
    },
  });

  const project2 = await prisma.project.create({
    data: {
      title: "مشروع إفطار صائم",
      description: "توفير وجبات إفطار للصائمين في رمضان ٢٠٢٦",
      targetAmount: 200000,
      collectedAmount: 175000,
      completionPercent: 88,
      startDate: new Date("2025-02-01"),
      status: ProjectStatus.ACTIVE,
      category: "إغاثة",
      creatorId: adminUser.id,
    },
  });

  // ===== المانحون والتبرعات =====
  const donor1 = await prisma.donor.create({
    data: {
      name: "محمد العبدالله",
      phone: "0555555551",
      email: "mohammed@example.com",
      donorType: DonorType.INDIVIDUAL,
      totalDonations: 12500,
      lastDonationAt: new Date(),
      status: DonorStatus.ACTIVE,
    },
  });

  const donor2 = await prisma.donor.create({
    data: {
      name: "شركة الأمل التجارية",
      phone: "0112345678",
      email: "charity@alamal.sa",
      donorType: DonorType.CORPORATE,
      totalDonations: 75000,
      lastDonationAt: new Date(),
      status: DonorStatus.ACTIVE,
    },
  });

  // تبرعات
  await prisma.donation.createMany({
    data: [
      { donorId: donor1.id, campaignId: campaign1.id, amount: 500, status: DonationStatus.COMPLETED, paymentMethod: "mada" },
      { donorId: donor1.id, projectId: project2.id, amount: 1000, status: DonationStatus.COMPLETED, paymentMethod: "visa" },
      { donorId: donor2.id, campaignId: campaign2.id, amount: 5000, status: DonationStatus.COMPLETED, paymentMethod: "bank_transfer" },
      { isGuest: true, isAnonymous: false, guestName: "متبرع متطوع", guestPhone: "0567891234", campaignId: campaign1.id, amount: 200, status: DonationStatus.COMPLETED, paymentMethod: "stcpay" },
    ],
  });

  // ===== الأعضاء =====
  const memberUser = await prisma.user.upsert({
    where: { email: "member@asas.sa" },
    update: {},
    create: {
      name: "أحمد العضو",
      email: "member@asas.sa",
      phone: "0512345680",
      password: passwordHash,
      role: Role.MEMBER,
    },
  });
  await prisma.organizationMembership.create({
    data: { organizationId: organization.id, userId: memberUser.id, role: Role.MEMBER, isDefault: true },
  });
  await prisma.user.update({ where: { id: memberUser.id }, data: { activeOrganizationId: organization.id } });

  await prisma.member.create({
    data: {
      userId: memberUser.id,
      membershipType: MembershipType.REGULAR,
      status: MembershipStatus.ACTIVE,
      startDate: new Date("2025-01-01"),
      endDate: new Date("2026-01-01"),
      membershipFee: 500,
      paidAmount: 500,
      paymentStatus: PaymentStatus.PAID,
    },
  });

  // ===== المستفيدون =====
  await prisma.beneficiary.createMany({
    data: [
      { name: "سعد الفايز", phone: "0551112222", nationalId: "1009876543", gender: Gender.MALE, status: BeneficiaryStatus.ACTIVE, familyMembers: 6, needCategory: "كفالة أيتام" },
      { name: "نوال الحربي", phone: "0551113333", nationalId: "1009876544", gender: Gender.FEMALE, status: BeneficiaryStatus.ACTIVE, familyMembers: 4, needCategory: "مساعدة مالية" },
      { name: "عبدالله الشمري", phone: "0551114444", nationalId: "1009876545", gender: Gender.MALE, status: BeneficiaryStatus.ACTIVE, familyMembers: 8, needCategory: "رعاية صحية" },
    ],
  });

  // ===== المتطوعون =====
  const volunteerUser = await prisma.user.upsert({
    where: { email: "volunteer@asas.sa" },
    update: {},
    create: {
      name: "سارة المتطوعة",
      email: "volunteer@asas.sa",
      phone: "0512345681",
      password: passwordHash,
      role: Role.VOLUNTEER,
    },
  });
  await prisma.organizationMembership.create({
    data: { organizationId: organization.id, userId: volunteerUser.id, role: Role.VOLUNTEER, isDefault: true },
  });
  await prisma.user.update({ where: { id: volunteerUser.id }, data: { activeOrganizationId: organization.id } });

  const volunteer = await prisma.volunteer.upsert({
    where: { userId: volunteerUser.id },
    update: {
      skills: ["تنظيم فعاليات", "تصوير", "تدريس"],
    },
    create: {
      userId: volunteerUser.id,
      skills: ["تنظيم فعاليات", "تصوير", "تدريس"],
      availability: "مرن",
      totalHours: 25,
      status: VolunteerStatus.ACTIVE,
    },
  });

  // ===== الفعاليات =====
  const event1 = await prisma.event.create({
    data: {
      title: "حفل تكريم المتطوعين",
      description: "حفل تكريم سنوي للمتطوعين المتميزين",
      startDate: new Date("2026-09-01T18:00"),
      endDate: new Date("2026-09-01T21:00"),
      location: "قاعة الرياض - حي العليا",
      capacity: 200,
      status: EventStatus.UPCOMING,
    },
  });

  await prisma.eventAttendance.createMany({
    data: [
      { eventId: event1.id, userId: volunteerUser.id, status: AttendanceStatus.REGISTERED },
      { eventId: event1.id, userId: memberUser.id, status: AttendanceStatus.REGISTERED },
    ],
  });

  // ===== المهام =====
  await prisma.task.createMany({
    data: [
      { title: "تجهيز تقرير التبرعات الشهري", status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH, assigneeId: adminUser.id, creatorId: adminUser.id, dueDate: new Date("2026-08-20") },
      { title: "تصميم بوسترات الحملة الجديدة", status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, assigneeId: editorUser.id, creatorId: adminUser.id, dueDate: new Date("2026-08-25") },
      { title: "متابعة كفالة الأيتام", status: TaskStatus.IN_PROGRESS, priority: TaskPriority.MEDIUM, assigneeId: editorUser.id, creatorId: adminUser.id },
      { title: "تحديث قاعدة بيانات المستفيدين", status: TaskStatus.TODO, priority: TaskPriority.LOW, assigneeId: editorUser.id, creatorId: adminUser.id },
    ],
  });

  // ===== الاستبيانات =====
  const survey = await prisma.survey.create({
    data: {
      title: "استبيان رضا المستفيدين",
      description: "استبيان لقياس رضا المستفيدين عن خدمات الجمعية",
      status: SurveyStatus.ACTIVE,
      startDate: new Date(),
      isPublic: true,
    },
  });

  await prisma.surveyQuestion.createMany({
    data: [
      { surveyId: survey.id, question: "كيف تقيم جودة الخدمات المقدمة؟", type: "rating", required: true },
      { surveyId: survey.id, question: "ما المدة التي تتعامل بها مع الجمعية؟", type: "single_choice", options: JSON.stringify(["أقل من سنة", "1-3 سنوات", "أكثر من 3 سنوات"]), required: true },
      { surveyId: survey.id, question: "هل تنصح بالجمعية لغيرك؟", type: "single_choice", options: JSON.stringify(["نعم", "ربما", "لا"]), required: true },
      { surveyId: survey.id, question: "ملاحظات إضافية", type: "text", required: false },
    ],
  });

  // ===== KPIs =====
  const kpi1 = await prisma.kPI.create({
    data: {
      title: "معدل استيفاء المشاريع في الوقت المحدد",
      description: "نسبة المشاريع المكتملة قبل الموعد النهائي",
      targetEntity: KPITargetEntity.DEPARTMENT,
      unit: "%",
      targetValue: 90,
      strategicGoal: "رفع كفاءة تنفيذ المشاريع",
      frequency: "quarterly",
      status: KPIStatus.ACTIVE,
    },
  });

  const kpi2 = await prisma.kPI.create({
    data: {
      title: "نسبة تحقيق هدف المؤسسة في الإيرادات",
      description: "نسبة الإيرادات المحققة مقابل المستهدفة سنوياً",
      targetEntity: KPITargetEntity.DEPARTMENT,
      unit: "%",
      targetValue: 100,
      strategicGoal: "تحقيق الاستدامة المالية",
      frequency: "yearly",
      status: KPIStatus.ACTIVE,
    },
  });

  await prisma.kPIRecord.createMany({
    data: [
      { kpiId: kpi1.id, period: "2026-Q2", actualValue: 85, targetValue: 90, percent: 94 },
      { kpiId: kpi2.id, period: "2026", actualValue: 72, targetValue: 100, percent: 72 },
    ],
  });

  // ===== تقييمات الموظفين =====
  const evaluation = await prisma.evaluation.create({
    data: {
      employeeId: editorUser.id,
      evaluatorId: adminUser.id,
      period: "2026-H1",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-06-30"),
      status: EvaluationStatus.COMPLETED,
      finalScore: 87,
    },
  });

  // ===== المتجر =====
  await prisma.storeProduct.createMany({
    data: [
      { name: "كتاب الجمعية التذكاري", description: "كتاب عن تاريخ وإنجازات الجمعية", price: 50, stock: 100, isActive: true },
      { name: "هدايا خيرية", description: "مجموعة هدايا تبرع", price: 100, stock: 50, isActive: true },
      { name: "سلة الخير", description: "سلة غذائية لعائلة محتاجة", price: 200, stock: 0, isActive: true },
    ],
  });

  // ===== الإعلانات =====
  await prisma.announcement.createMany({
    data: [
      { title: "حملة رمضان ٢٠٢٦", content: "انضموا إلى حملة رمضان الكبرى", startDate: new Date(), isFeatured: true, isActive: true },
      { title: "نادي الأطفال الصيفي", content: "سجل أطفالك في نادي الصيف", startDate: new Date(), isActive: true },
    ],
  });

  // ===== مكتبة الصور =====
  const album = await prisma.photoAlbum.create({
    data: {
      title: "فعاليات ٢٠٢٥",
      description: "صور من فعاليات الجمعية خلال عام ٢٠٢٥",
    },
  });

  await prisma.photo.createMany({
    data: [
      { albumId: album.id, title: "حفل إفطار", url: "/images/event1.jpg", thumbnailUrl: "/images/event1-thumb.jpg" },
      { albumId: album.id, title: "توزيع المساعدات", url: "/images/event2.jpg" },
    ],
  });

  // ===== الصفحات =====
  await prisma.contentPage.createMany({
    data: [
      { title: "نظام الجمعية الأساسي", slug: "bylaws", content: "هذا النظام الأساسي للجمعية...", category: "systems", isPublished: true },
      { title: "تعليمات التبرع", slug: "donation-rules", content: "تعليمات وإرشادات التبرع...", category: "instructions", isPublished: true },
      { title: "سياسة الخصوصية", slug: "privacy", content: "سياسة الخصوصية للجمعية...", category: "policies", isPublished: true },
    ],
  });

  // ===== قوالب SMS =====
  await prisma.sMSTemplate.createMany({
    data: [
      { name: "تنبيه انتهاء العضوية", content: "عزيزي {{name}}، تنتهي عضويتك في الجمعية بتاريخ {{date}}. يرجى التجديد.", category: "membership_expiry", isActive: true },
      { name: "إشعار تبرع", content: "شكراً {{name}} على تبرعك بقيمة {{amount}} ر.س. رقم الفاتورة: {{invoiceNo}}.", category: "donation_receipt", isActive: true },
      { name: "تذكير فعالية", content: "تذكير: فعالية {{event}} يوم {{date}}. نتشرف بتواجدكم.", category: "event_reminder", isActive: true },
      { name: "تقييم الموظفين", content: "عزيزي {{managerName}}، لديك تقييمات موظفين معلقة. يرجى المتابعة.", category: "evaluation_pending", isActive: true },
    ],
  });

  console.log("✅ اكتمل بذر البيانات التجريبية بنجاح!");
  console.log("");
  console.log("🔑 بيانات الدخول:");
  console.log("   المدير: admin@asas.sa / admin123");
  console.log("   المحرر: editor@asas.sa / admin123");
  console.log("   العضو: member@asas.sa / admin123");
  console.log("   المتطوع: volunteer@asas.sa / admin123");
}


main()
  .catch((e) => {
    console.error("❌ خطأ في البذار:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
