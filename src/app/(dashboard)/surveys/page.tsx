"use client";

/** فلسفة التصميم: سجلّ المؤسسة الهادئ — مساحة استبيانات تتقدم بالقرار لا بالضوضاء. */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { EmptyWorkspace, MetricCard, PageHero, StatusPill, WorkspaceCard } from "@/components/platform/ops-ui";

type Survey = { id: string; title: string; description: string | null; status: "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED"; isPublic: boolean; startDate: string | null; endDate: string | null; _count: { questions: number; responses: number } };
type SurveyQuestion = { id: string; question: string; type: "text" | "single_choice" | "multiple_choice" | "rating" | "scale"; options: string[] | null; required: boolean; sortOrder: number };

const stateTone = { DRAFT: ["مسودة", "slate"], ACTIVE: ["نشط", "teal"], CLOSED: ["مغلق", "amber"], ARCHIVED: ["مؤرشف", "rose"] } as const;

export default function SurveysPage() {
  const [surveys, setSurveys] = React.useState<Survey[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [activeSurvey, setActiveSurvey] = React.useState<Survey | null>(null);
  const [questions, setQuestions] = React.useState<SurveyQuestion[]>([]);
  const [questionLoading, setQuestionLoading] = React.useState(false);
  const { addToast } = useToast();

  const loadSurveys = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/surveys");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحميل الاستبيانات");
      setSurveys(Array.isArray(data) ? data : data.data ?? []);
    } catch (error) {
      addToast({ type: "error", title: "تعذر التحميل", description: error instanceof Error ? error.message : "حدث خطأ غير متوقع" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  React.useEffect(() => { void loadSurveys(); }, [loadSurveys]);

  async function createSurvey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get("title") || ""),
      description: String(form.get("description") || ""),
      startDate: String(form.get("startDate") || "") || undefined,
      endDate: String(form.get("endDate") || "") || undefined,
      isPublic: form.get("isPublic") === "on",
    };
    const response = await fetch("/api/surveys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) {
      addToast({ type: "error", title: "تعذر إنشاء الاستبيان", description: data.error || "تحقق من الحقول المطلوبة" });
      return;
    }
    setSurveys((current) => [data, ...current]);
    event.currentTarget.reset();
    setCreating(false);
    addToast({ type: "success", title: "تم إنشاء الاستبيان", description: "أضف الأسئلة وحدد الجمهور قبل النشر." });
  }

  async function openQuestionEditor(survey: Survey) {
    setActiveSurvey(survey);
    setQuestionLoading(true);
    try {
      const response = await fetch(`/api/surveys/${survey.id}/questions`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحميل الأسئلة");
      setQuestions(Array.isArray(data) ? data : []);
    } catch (error) {
      addToast({ type: "error", title: "تعذر فتح محرر الأسئلة", description: error instanceof Error ? error.message : "حاول لاحقًا" });
    } finally { setQuestionLoading(false); }
  }

  async function addQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSurvey) return;
    const form = new FormData(event.currentTarget);
    const rawOptions = String(form.get("options") || "").split("\n").map((value) => value.trim()).filter(Boolean);
    const payload = { question: String(form.get("question") || ""), type: String(form.get("type") || "text"), options: rawOptions.length ? rawOptions : undefined, required: form.get("required") === "on" };
    const response = await fetch(`/api/surveys/${activeSurvey.id}/questions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) { addToast({ type: "error", title: "تعذر إضافة السؤال", description: data.error || "تحقق من السؤال والخيارات" }); return; }
    setQuestions((current) => [...current, data]);
    setSurveys((current) => current.map((survey) => survey.id === activeSurvey.id ? { ...survey, _count: { ...survey._count, questions: survey._count.questions + 1 } } : survey));
    setActiveSurvey((current) => current ? { ...current, _count: { ...current._count, questions: current._count.questions + 1 } } : current);
    event.currentTarget.reset();
    addToast({ type: "success", title: "تمت إضافة السؤال", description: "يمكنك إضافة سؤال آخر أو إغلاق المحرر عند الاكتفاء." });
  }

  const activeCount = surveys.filter((survey) => survey.status === "ACTIVE").length;
  const responseCount = surveys.reduce((sum, survey) => sum + survey._count.responses, 0);

  return (
    <div className="space-y-6">
      <PageHero eyebrow="OPERATIONS · VOICE OF COMMUNITY" title="الاستبيانات وقياس الأثر" description="التقط صوت الأعضاء والمستفيدين والمتطوعين، ثم حوّل الإجابات إلى قرارات خدمة قابلة للقياس." actions={<Button onClick={() => setCreating((open) => !open)} className="bg-white text-teal-800 hover:bg-teal-50">{creating ? "إغلاق المحرر" : "إنشاء استبيان"}</Button>} />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="استبيانات نشطة" value={activeCount} detail="تجمع إجابات الآن" tone="teal" />
        <MetricCard label="إجمالي الردود" value={responseCount} detail="إجابات مسجلة في المنصة" tone="amber" />
        <MetricCard label="مسودات قيد الإعداد" value={surveys.filter((survey) => survey.status === "DRAFT").length} detail="جاهزة لاستكمال الأسئلة" tone="slate" />
      </div>
      {creating && (
        <WorkspaceCard title="استبيان جديد" description="ابدأ بعنوان واضح وفترة نشر محددة. سيبقى الاستبيان مسودة حتى تحدد تاريخ بدءه." status={<StatusPill label="إعداد" tone="amber" />}>
          <form onSubmit={createSurvey} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><Label htmlFor="title">عنوان الاستبيان</Label><Input id="title" name="title" className="mt-1" placeholder="مثال: قياس رضا المستفيدين عن برنامج السلال" required /></div>
            <div className="md:col-span-2"><Label htmlFor="description">الغرض من القياس</Label><Textarea id="description" name="description" className="mt-1" rows={3} placeholder="ما القرار الذي سيساعد هذا الاستبيان في اتخاذه؟" /></div>
            <div><Label htmlFor="startDate">تاريخ البدء</Label><Input id="startDate" name="startDate" type="date" className="mt-1" /></div>
            <div><Label htmlFor="endDate">تاريخ الإغلاق</Label><Input id="endDate" name="endDate" type="date" className="mt-1" /></div>
            <label className="md:col-span-2 flex items-center gap-2 text-sm text-slate-700"><input name="isPublic" type="checkbox" className="h-4 w-4 accent-teal-700" /> متاح عبر رابط عام للمستفيدين والشركاء</label>
            <div className="md:col-span-2 flex justify-end"><Button type="submit">حفظ الاستبيان</Button></div>
          </form>
        </WorkspaceCard>
      )}
      {activeSurvey && <WorkspaceCard title={`محرر أسئلة: ${activeSurvey.title}`} description="رتّب الأسئلة بصورة عملية؛ استخدم سطرًا لكل خيار في أسئلة الاختيار." status={<button type="button" onClick={() => setActiveSurvey(null)} className="text-sm font-bold text-slate-500 hover:text-slate-900">إغلاق المحرر</button>}>
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border bg-slate-50/80 p-4"><p className="text-sm font-bold text-slate-900">الأسئلة الحالية ({questions.length})</p>{questionLoading ? <p className="mt-3 text-sm text-muted-foreground">جارٍ تحميل الأسئلة…</p> : questions.length ? <ol className="mt-3 space-y-3">{questions.map((item, index) => <li key={item.id} className="rounded-md border bg-white p-3"><div className="flex justify-between gap-2"><span className="font-bold text-teal-800">{index + 1}</span><p className="flex-1 text-sm font-medium">{item.question}</p></div><p className="mt-2 text-xs text-muted-foreground">{item.type === "text" ? "إجابة نصية" : item.type === "rating" ? "تقييم" : item.type === "scale" ? "مقياس" : "اختيارات"} · {item.required ? "إلزامي" : "اختياري"}</p></li>)}</ol> : <p className="mt-3 text-sm text-muted-foreground">لا توجد أسئلة حتى الآن. أضف سؤالًا من النموذج المجاور.</p>}</div>
          <form onSubmit={addQuestion} className="grid gap-4"><div><Label htmlFor="question">نص السؤال</Label><Textarea id="question" name="question" className="mt-1" rows={2} placeholder="مثال: كيف تقيم سهولة الوصول إلى الخدمة؟" required /></div><div><Label htmlFor="type">نوع الإجابة</Label><Select name="type" defaultValue="text" options={[{ value: "text", label: "إجابة نصية" }, { value: "single_choice", label: "اختيار واحد" }, { value: "multiple_choice", label: "اختيارات متعددة" }, { value: "rating", label: "تقييم" }, { value: "scale", label: "مقياس" }]} /></div><div><Label htmlFor="options">الخيارات (اختياري)</Label><Textarea id="options" name="options" className="mt-1" rows={3} placeholder={"ممتاز\nجيد جدًا\nجيد\nيحتاج تحسين"} /><p className="mt-1 text-xs text-muted-foreground">اكتب كل خيار في سطر مستقل عند اختيار نوع متعدد الخيارات.</p></div><label className="flex items-center gap-2 text-sm text-slate-700"><input name="required" type="checkbox" className="h-4 w-4 accent-teal-700" /> سؤال إلزامي</label><div className="flex justify-end"><Button type="submit">إضافة السؤال</Button></div></form>
        </div>
      </WorkspaceCard>}
      {loading ? <div className="rounded-xl border bg-white p-10 text-center text-muted-foreground">جارٍ تجهيز سجل الاستبيانات…</div> : surveys.length === 0 ? <EmptyWorkspace title="لا توجد استبيانات بعد" description="ابدأ بقياس تجربة المستفيدين أو رضا المتطوعين، ثم حوّل النتائج إلى تحسينات قابلة للمتابعة." action={<Button onClick={() => setCreating(true)}>إنشاء أول استبيان</Button>} /> : <div className="grid gap-4 lg:grid-cols-2">{surveys.map((survey) => { const [label, tone] = stateTone[survey.status]; return <WorkspaceCard key={survey.id} title={survey.title} description={survey.description || "لم يضف فريق العمل وصفًا لهذا الاستبيان بعد."} status={<StatusPill label={label} tone={tone} />} meta={`${survey._count.questions} أسئلة · ${survey._count.responses} إجابات · ${survey.isPublic ? "متاح للجمهور" : "داخلي"}`}><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{survey.startDate ? `يبدأ ${new Date(survey.startDate).toLocaleDateString("ar-SA")}` : "لم يحدد تاريخ نشر"}</span><button type="button" onClick={() => void openQuestionEditor(survey)} className="font-bold text-teal-700 hover:text-teal-900">إدارة الأسئلة ←</button></div></WorkspaceCard>; })}</div>}
    </div>
  );
}
