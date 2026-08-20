import { getOrganizationSettings } from "@/modules/settings/organization";
import { notFound } from "next/navigation";
import { AppearanceForm } from "./_components/appearance-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AppearancePage() {
  const organization = await getOrganizationSettings();

  if (!organization) {
    return <Card><CardHeader><CardTitle>خطأ</CardTitle><CardDescription>لم يتم العثور على إعدادات المنظمة.</CardDescription></CardHeader></Card>;
  }

  return (
    <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <AppearanceForm initialData={organization} />
    </main>
  );
}