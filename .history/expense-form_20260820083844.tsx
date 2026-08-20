"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Budget, BudgetItem } from "@prisma/client";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  title: z.string().min(3, "البيان مطلوب"),
  amount: z.coerce.number().min(0.01, "المبلغ يجب أن يكون أكبر من صفر"),
  expenseDate: z.date({ required_error: "تاريخ الصرف مطلوب" }),
  description: z.string().optional(),
  budgetItemId: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof formSchema>;

type BudgetWithItems = Budget & { items: BudgetItem[] };

interface ExpenseFormProps {
  budgets: BudgetWithItems[];
}

export function ExpenseForm({ budgets }: ExpenseFormProps) {
  const router = useRouter();
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      expenseDate: new Date(),
    },
  });

  const onSubmit = async (data: ExpenseFormValues) => {
    try {
      const response = await fetch("/api/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("فشلت عملية إضافة المصروف");

      router.push("/finance/expenses");
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
            <CardTitle>إضافة مصروف جديد</CardTitle>
            <CardDescription>املأ بيانات المصروف وقم بربطه ببند ميزانية إن أمكن.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>البيان</FormLabel>
                  <FormControl><Input placeholder="مثال: شراء أجهزة مكتبية" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>المبلغ</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="expenseDate" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>تاريخ الصرف</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? format(field.value, "PPP") : <span>اختر تاريخاً</span>}
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
              <FormField control={form.control} name="budgetItemId" render={({ field }) => (
                <FormItem>
                  <FormLabel>ربط ببند ميزانية (اختياري)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="اختر بنداً لربط المصروف به" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {budgets.map((budget) => (
                        <SelectGroup key={budget.id}>
                          <SelectLabel>{budget.title}</SelectLabel>
                          {budget.items.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.category}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>ملاحظات إضافية</FormLabel>
                <FormControl><Textarea placeholder="أي تفاصيل إضافية حول هذا المصروف" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>إلغاء</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "جاري الحفظ..." : "حفظ المصروف"}
          </Button>
        </div>
      </form>
    </Form>
  );
}