"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const formSchema = z.object({
  description: z.string().min(5, { message: "الوصف يجب أن يكون 5 أحرف على الأقل." }),
  hours: z.coerce.number().min(0.5, { message: "يجب إدخال عدد ساعات صحيح." }),
  activityDate: z.date({ required_error: "يجب تحديد تاريخ النشاط." }),
});

type ActivityFormValues = z.infer<typeof formSchema>;

interface ActivityFormProps {
  volunteerId: string;
}

export function ActivityForm({ volunteerId }: ActivityFormProps) {
  const router = useRouter();
  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      activityDate: new Date(),
    }
  });

  const onSubmit = async (data: ActivityFormValues) => {
    try {
      const response = await fetch(`/api/volunteers/${volunteerId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("فشلت عملية إضافة النشاط");

      router.refresh();
      form.reset();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>وصف النشاط</FormLabel>
              <FormControl>
                <Textarea placeholder="مثال: المشاركة في تنظيم فعالية اليوم الوطني" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="hours"
            render={({ field }) => (
              <FormItem>
                <FormLabel>عدد الساعات</FormLabel>
                <FormControl>
                  <Input type="number" step="0.5" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="activityDate"
            render={({ field }) => (
              <FormItem className="flex flex-col pt-2">
                <FormLabel>تاريخ النشاط</FormLabel>
                {/* ... (Popover with Calendar similar to renewal-form) ... */}
                <FormControl>
                   <Input type="date" {...field} value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''} onChange={(e) => field.onChange(new Date(e.target.value))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "جاري الحفظ..." : "حفظ النشاط"}
        </Button>
      </form>
    </Form>
  );
}