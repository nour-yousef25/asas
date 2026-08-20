"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Organization } from "@prisma/client";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const formSchema = z.object({
  name: z.string().min(3, "اسم المنظمة مطلوب"),
  logo: z.string().url("يجب أن يكون رابطاً صحيحاً").optional().or(z.literal('')),
  primaryColor: z.string().regex(/^#([0-9a-f]{3}){1,2}$/i, "صيغة اللون غير صحيحة"),
  secondaryColor: z.string().regex(/^#([0-9a-f]{3}){1,2}$/i, "صيغة اللون غير صحيحة"),
  accentColor: z.string().regex(/^#([0-9a-f]{3}){1,2}$/i, "صيغة اللون غير صحيحة"),
});

type AppearanceFormValues = z.infer<typeof formSchema>;

interface AppearanceFormProps {
  initialData: Organization;
}

export function AppearanceForm({ initialData }: AppearanceFormProps) {
  const router = useRouter();
  const form = useForm<AppearanceFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData.name || "",
      logo: initialData.logo || "",
      primaryColor: initialData.primaryColor || "#0D9488",
      secondaryColor: initialData.secondaryColor || "#115E59",
      accentColor: initialData.accentColor || "#F59E0B",
    },
  });

  const onSubmit = async (data: AppearanceFormValues) => {
    try {
      const response = await fetch("/api/settings/organization", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("فشلت عملية تحديث المظهر");

      // Refresh the entire page to apply new CSS variables
      window.location.reload();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>تخصيص المظهر</CardTitle>
            <CardDescription>
              قم بتخصيص هوية المنظمة البصرية، بما في ذلك الشعار والألوان الأساسية.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>اسم المنظمة</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="logo" render={({ field }) => (
              <FormItem>
                <FormLabel>رابط الشعار</FormLabel>
                <FormControl><Input placeholder="https://example.com/logo.png" {...field} /></FormControl>
                <FormDescription>سيظهر هذا الشعار في رأس الصفحة والتقارير المطبوعة.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField control={form.control} name="primaryColor" render={({ field }) => (
                <FormItem>
                  <FormLabel>اللون الأساسي</FormLabel>
                  <FormControl><Input type="color" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="secondaryColor" render={({ field }) => (
                <FormItem>
                  <FormLabel>اللون الثانوي</FormLabel>
                  <FormControl><Input type="color" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="accentColor" render={({ field }) => (
                <FormItem>
                  <FormLabel>لون التمييز</FormLabel>
                  <FormControl><Input type="color" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "جاري الحفظ..." : "حفظ التغييرات"}
          </Button>
        </div>
      </form>
    </Form>
  );
}