"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ContentPage } from "@prisma/client";

const formSchema = z.object({
  title: z.string().min(3, "يجب أن يكون العنوان 3 أحرف على الأقل"),
  slug: z
    .string()
    .min(3, "يجب أن يكون الرابط 3 أحرف على الأقل")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "الرابط يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط"
    ),
  category: z.string().min(2, "يجب تحديد الفئة"),
  content: z.string().min(10, "يجب أن يكون المحتوى 10 أحرف على الأقل"),
  isPublished: z.boolean(),
});

type ContentPageFormValues = z.infer<typeof formSchema>;

interface ContentPageFormProps {
  initialData?: ContentPage | null;
}

export function ContentPageForm({ initialData }: ContentPageFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;

  const form = useForm<ContentPageFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      title: "",
      slug: "",
      category: "",
      content: "",
      isPublished: false,
    },
  });

  async function onSubmit(values: ContentPageFormValues) {
    try {
      const method = isEditing ? "PATCH" : "POST";
      const url = isEditing
        ? `/api/content/pages/${initialData?.id}`
        : "/api/content/pages";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error("حدث خطأ أثناء حفظ الصفحة.");
      }

      router.push("/content");
      router.refresh(); // To see the changes in the table
      alert(isEditing ? "تم تحديث الصفحة بنجاح" : "تم إنشاء الصفحة بنجاح");
    } catch (error) {
      console.error(error);
      alert("فشل حفظ الصفحة.");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>العنوان</FormLabel>
              <FormControl>
                <Input placeholder="عنوان الصفحة" {...field} />
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
                <Input placeholder="a-unique-slug" {...field} />
              </FormControl>
              <FormDescription>
                هذا هو الجزء الذي سيظهر في رابط الصفحة. استخدم أحرف إنجليزية
                صغيرة وأرقام وشرطات فقط.
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
              <FormLabel>الفئة</FormLabel>
              <FormControl>
                <Input placeholder="مثال: انظمة, تعليمات" {...field} />
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
                <Textarea
                  placeholder="محتوى الصفحة هنا..."
                  className="min-h-[200px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                هذا هو المحتوى الرئيسي للصفحة. سيتم استبداله بمحرر نصوص غني
                لاحقاً.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isPublished"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={Boolean(field.value)}
                  onChange={(event) => field.onChange(event.target.checked)}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>نشر الصفحة؟</FormLabel>
                <FormDescription>
                  إذا تم تحديد هذا الخيار، ستكون الصفحة مرئية للجميع.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
        <Button type="submit">{isEditing ? "حفظ التغييرات" : "إنشاء صفحة"}</Button>
      </form>
    </Form>
  );
}
