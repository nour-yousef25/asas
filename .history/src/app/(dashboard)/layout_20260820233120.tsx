import { DynamicThemeProvider } from "@/components/shared/dynamic-theme-provider";
import { prisma } from "@/lib/db";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // استخراج الثيم من قاعدة البيانات
  const organization = await prisma.organization.findFirst({
    where: { id: "default-organization-id" }, // يمكن تخصيص ID الجمعية بحسب المستخدم المسجل
  });

  if (!organization) {
    throw new Error("Organization not found.");
  }

  const theme = {
    name: organization.name,
    logo: organization.logo,
    primaryColor: organization.primaryColor,
    secondaryColor: organization.secondaryColor,
    accentColor: organization.accentColor,
  };

  return (
    <DynamicThemeProvider initialTheme={theme}>
      <DashboardShell>{children}</DashboardShell>
    </DynamicThemeProvider>
  );
}
