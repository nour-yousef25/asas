"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
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
import { TrashIcon, PlusCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const budgetItemSchema = z.object({
  category: z.string().min(1, "التصنيف مطلوب"),
  description: z.string().optional(),
  allocated: z.coerce.number().min(0, "المبلغ المخصص لا يمكن أن يكون سالباً"),
});

const formSchema = z.object({
  title: z.string().min(3, "العنوان مطلوب"),
  fiscalYear: z.string().regex(/^\d{4}$/, "أدخل سنة مالية صحيحة (YYYY)"),
  totalAmount: z.coerce.number(),
  status: z.enum(["DRAFT", "APPROVED", "ACTIVE", "CLOSED"]).default("DRAFT"),
  items: z.array(budgetItemSchema).min(1, "يجب إضافة بند واحد على الأقل للميزانية"),
});

type BudgetFormValues = z.infer<typeof formSchema>;

export function BudgetForm() {
  const router = useRouter();
  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      fiscalYear: new Date().getFullYear().toString(),
      totalAmount: 0,
      status: "DRAFT",
      items: [{ category: "", description: "", allocated: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const items = form.watch("items");
  useEffect(() => {
    const total = items.reduce((sum, item) => sum + (item.allocated || 0), 0);
    form.setValue("totalAmount", total);
  }, [items, form]);

  const onSubmit = async (data: BudgetFormValues) => {
    try {
      const response = await fetch("/api/finance/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("فشلت عملية إنشاء الميزانية");

      router.push("/finance/budget");
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
            <CardTitle>إنشاء ميزانية جديدة</CardTitle>
            <CardDescription>املأ البيانات الأساسية وأضف بنود الميزانية.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>عنوان الميزانية</FormLabel>
                  <FormControl><Input placeholder="ميزانية العام..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="fiscalYear" render={({ field }) => (
                <FormItem>
                  <FormLabel>السنة المالية</FormLabel>
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
                      <SelectItem value="DRAFT">مسودة</SelectItem>
                      <SelectItem value="APPROVED">معتمدة</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>بنود الميزانية</CardTitle>
            <FormDescription>
              إجمالي المبلغ المعتمد: {new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(form.getValues("totalAmount"))}
            </FormDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-4 items-start border p-4 rounded-md">
                <FormField control={form.control} name={`items.${index}.category`} render={({ field }) => (
                  <FormItem className="col-span-4">
                    <FormLabel>البند</FormLabel>
                    <FormControl><Input placeholder="مثال: رواتب وأجور" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name={`items.${index}.description`} render={({ field }) => (
                  <FormItem className="col-span-4">
                    <FormLabel>الوصف</FormLabel>
                    <FormControl><Input placeholder="وصف قصير للبند" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name={`items.${index}.allocated`} render={({ field }) => (
                  <FormItem className="col-span-3">
                    <FormLabel>المبلغ المخصص</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="col-span-1 flex justify-end pt-8">
                  <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => append({ category: "", description: "", allocated: 0 })}>
              <PlusCircle className="h-4 w-4 ml-2" />
              إضافة بند جديد
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>إلغاء</Button>
          <Button type="submit">حفظ الميزانية</Button>
        </div>
      </form>
    </Form>
  );
}