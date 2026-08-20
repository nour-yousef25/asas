import { getBudgetDetails } from "@/modules/finance/budget";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

type BudgetDetailsPageProps = {
  params: {
    id: string;
  };
};

function formatCurrency(amount: number | null | undefined) {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
  }).format(amount || 0);
}

export default async function BudgetDetailsPage({ params }: BudgetDetailsPageProps) {
  const budget = await getBudgetDetails(params.id);

  if (!budget) {
    notFound();
  }

  const spentPercentage = budget.totalAmount > 0 ? (budget.spentAmount / budget.totalAmount) * 100 : 0;

  return (
    <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{budget.title}</CardTitle>
              <CardDescription>
                تفاصيل ميزانية السنة المالية {budget.fiscalYear}
              </CardDescription>
            </div>
            <Badge variant="outline">{budget.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">المبلغ المعتمد</span>
              <span className="text-xl font-bold">{formatCurrency(budget.totalAmount)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">المبلغ المصروف</span>
              <span className="text-xl font-bold text-red-600">{formatCurrency(budget.spentAmount)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">المبلغ المتبقي</span>
              <span className="text-xl font-bold text-green-600">{formatCurrency(budget.totalAmount - budget.spentAmount)}</span>
            </div>
          </div>
          <div>
            <Progress value={spentPercentage} className="w-full" />
            <p className="text-sm text-muted-foreground mt-2">
              تم صرف {spentPercentage.toFixed(2)}% من إجمالي الميزانية.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>بنود الميزانية</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>البند</TableHead>
                <TableHead>المبلغ المخصص</TableHead>
                <TableHead>المبلغ المصروف</TableHead>
                <TableHead>المبلغ المتبقي</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budget.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.category}</TableCell>
                  <TableCell>{formatCurrency(item.allocated)}</TableCell>
                  <TableCell className="text-red-500">{formatCurrency(item.spent)}</TableCell>
                  <TableCell className="text-green-500">{formatCurrency(item.allocated - item.spent)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}