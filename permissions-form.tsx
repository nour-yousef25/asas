"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Permission, User } from "@prisma/client";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
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

const formSchema = z.object({
  permissionIds: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: "يجب أن تختار صلاحية واحدة على الأقل.",
  }),
});

type PermissionsFormValues = z.infer<typeof formSchema>;

type GroupedPermissions = Record<string, Permission[]>;

interface PermissionsFormProps {
  user: User;
  allPermissions: GroupedPermissions;
  currentUserPermissionIds: string[];
}

export function PermissionsForm({ user, allPermissions, currentUserPermissionIds }: PermissionsFormProps) {
  const router = useRouter();
  const form = useForm<PermissionsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      permissionIds: currentUserPermissionIds,
    },
  });

  const onSubmit = async (data: PermissionsFormValues) => {
    try {
      const response = await fetch(`/api/users/${user.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("فشلت عملية تحديث الصلاحيات");

      router.push("/users");
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
            <CardTitle>إدارة صلاحيات المستخدم</CardTitle>
            <CardDescription>
              تعيين الصلاحيات للمستخدم: <span className="font-bold">{user.name}</span>
            </CardDescription>
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
            {form.formState.isSubmitting ? "جاري الحفظ..." : "حفظ الصلاحيات"}
          </Button>
        </div>
      </form>
    </Form>
  );
}