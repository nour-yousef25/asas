"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Permission, Role } from "@prisma/client";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  name: z.string().min(2, "اسم الدور مطلوب"),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).min(1, "يجب اختيار صلاحية واحدة على الأقل."),
});

type RoleFormValues = z.infer<typeof formSchema>;

type GroupedPermissions = Record<string, Permission[]>;
type RoleWithPermissions = Role & { permissions: { permissionId: string }[] };

interface RoleFormProps {
  initialData?: RoleWithPermissions | null;
  allPermissions: GroupedPermissions;
}

export function RoleForm({ initialData, allPermissions }: RoleFormProps) {
  const router = useRouter();
  const isEditMode = !!initialData;

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      permissionIds: initialData?.permissions.map(p => p.permissionId) || [],
    },
  });

  const onSubmit = async (data: RoleFormValues) => {
    try {
      const url = isEditMode ? `/api/users/roles/${initialData?.id}` : "/api/users/roles";
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error(`فشلت عملية ${isEditMode ? "تحديث" : "إنشاء"} الدور`);

      router.push("/users/roles");
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
            <CardTitle>{isEditMode ? "تعديل دور" : "إنشاء دور جديد"}</CardTitle>
            <CardDescription>املأ بيانات الدور وحدد الصلاحيات المرتبطة به.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>اسم الدور</FormLabel>
                <FormControl><Input placeholder="مثال: مدير محتوى" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>الوصف</FormLabel>
                <FormControl><Textarea placeholder="وصف قصير لمسؤوليات هذا الدور" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>صلاحيات الدور</CardTitle>
            <CardDescription>اختر الصلاحيات التي سيتم منحها لهذا الدور.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(allPermissions).map(([moduleName, permissions]) => (
              <div key={moduleName} className="space-y-4 rounded-lg border p-4">
                <h3 className="font-semibold">{moduleName}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="permissionIds"
                    render={() => (
                      <>
                        {permissions.map((permission) => (
                          <FormField
                            key={permission.id}
                            control={form.control}
                            name="permissionIds"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0 space-x-reverse">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(permission.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, permission.id])
                                        : field.onChange(field.value?.filter((value) => value !== permission.id));
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">{permission.description || permission.name}</FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </>
                    )}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>إلغاء</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "جاري الحفظ..." : (isEditMode ? "حفظ التعديلات" : "حفظ الدور")}
          </Button>
        </div>
      </form>
    </Form>
  );
}