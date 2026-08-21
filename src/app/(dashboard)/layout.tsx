import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DynamicThemeProvider } from "@/components/shared/dynamic-theme-provider";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { prisma } from "@/lib/db";
import { getOrganizationContext } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // فلسفة التصميم: سجلّ المؤسسة الهادئ — الهوية تأتي من سياق الجمعية المعزول لا من معرف ثابت.
  const context = await getOrganizationContext();
  const organization = await prisma.organization.findUnique({ where: { id: context.organizationId } });

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
