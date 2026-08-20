"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Event, EventStatus } from "@prisma/client";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const formSchema = z.object({
  title: z.string().min(3, "العنوان مطلوب ويجب أن يكون 3 أحرف على الأقل"),
  description: z.string().optional(),
  startDate: z.date({ required_error: "تاريخ البدء مطلوب" }),
  endDate: z.date().optional(),
  location: z.string().optional(),
  capacity: z.coerce.number().int().positive().optional(),
  status: z.nativeEnum(EventStatus).default(EventStatus.UPCOMING),
});

type EventFormValues = z.infer<typeof formSchema>;

interface EventFormProps {
  initialData?: Event | null;
}

export function EventForm({ initialData }: EventFormProps) {
  const router = useRouter();
  const isEditMode = !!initialData;

  const form = useForm<EventFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
      ...initialData,
      capacity: initialData.capacity ?? undefined,
    } : {
      title: "",
      description: "",
      startDate: new Date(),
      location: "",
      status: EventStatus.UPCOMING,
    },
  });

  const onSubmit = async (data: EventFormValues) => {
    try {
      const url = isEditMode ? `/api/events/${initialData?.id}` : "/api/events";
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error(`فشلت عملية ${isEditMode ? "تحديث" : "إنشاء"} الفعالية`);

      router.push("/events");
      router.refresh();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>{isEditMode ? "تعديل فعالية" : "إنشاء فعالية جديدة"}</CardTitle>
            <CardDescription>املأ بيانات الفعالية أدناه.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>عنوان الفعالية</FormLabel>
                <FormControl><Input placeholder="مثال: الملتقى السنوي للمتطوعين" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>وصف الفعالية</FormLabel>
                <FormControl><Textarea placeholder="وصف قصير للفعالية وأهدافها" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>تاريخ ووقت البدء</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? format(field.value, "PPP p") : <span>اختر تاريخاً</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>تاريخ ووقت الانتهاء (اختياري)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? format(field.value, "PPP p") : <span>اختر تاريخاً</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel>المكان</FormLabel>
                  <FormControl><Input placeholder="مثال: قاعة الملك فهد" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="capacity" render={({ field }) => (
                <FormItem>
                  <FormLabel>السعة (اختياري)</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>الحالة</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="UPCOMING">قادمة</SelectItem>
                      <SelectItem value="ONGOING">جارية</SelectItem>
                      <SelectItem value="COMPLETED">مكتملة</SelectItem>
                      <SelectItem value="CANCELLED">ملغاة</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>إلغاء</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "جاري الحفظ..." : (isEditMode ? "حفظ التعديلات" : "حفظ الفعالية")}
          </Button>
        </div>
      </form>
    </Form>
  );
}