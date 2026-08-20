"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea"; // مؤقتاً بدلاً من محرر نصوص غني

const formSchema = z.object({
  title: z.string().min(3, { message: "العنوان يجب أن يكون 3 أحرف على الأقل" }),
  slug: z.string().min(3, { message: "الرابط يجب أن يكون 3 أحرف على الأقل" }),
  category: z.string().min(2, { message: "التصنيف مطلوب" }),
  content: z.string().min(10, { message: "المحتوى لا يمكن أن يكون فارغاً" }),
  isPublished: z.boolean().default(false),
});

type ContentFormValues = z.infer<typeof formSchema>;

export function ContentForm() {
  const router = useRouter();
  const form = useForm<ContentFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      slug: "",
      category: "",
      content: "",
      isPublished: false,
    },
  });

  const onSubmit = async (data: ContentFormValues) => {
    try {
      const response = await fetch("/api/content/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("فشلت عملية إنشاء الصفحة");
      }

      router.push("/content");
      router.refresh(); // لتحديث قائمة الصفحات
    } catch (error) {
      console.error(error);
      // هنا يمكن إضافة إشعار للمستخدم بوجود خطأ
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>إنشاء صفحة جديدة</CardTitle>
            <CardDescription>
              املأ الحقول التالية لإنشاء صفحة محتوى جديدة.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>العنوان</FormLabel>
                  <FormControl>
                    <Input placeholder="مثال: سياسة الاستخدام" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الرابط (Slug)</FormLabel>
                  <FormControl>
                    <Input placeholder="مثال: usage-policy" {...field} />
                  </FormControl>
                  <FormDescription>
                    هذا هو الجزء الذي سيظهر في رابط الصفحة. استخدم أحرفاً إنجليزية وشرطات فقط.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>التصنيف</FormLabel>
                  <FormControl>
                    <Input placeholder="مثال: سياسات" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>المحتوى</FormLabel>
                  <FormControl>
                    <Textarea rows={10} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isPublished"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>نشر الصفحة</FormLabel>
                    <FormDescription>
                      هل تريد نشر هذه الصفحة فوراً لتكون مرئية للجميع؟
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            إلغاء
          </Button>
          <Button type="submit">حفظ وإنشاء</Button>
        </div>
      </form>
    </Form>
  );
}