"use client";

/**
 * فلسفة التصميم: سجلّ المؤسسة الهادئ — مركز قرار اتصالي عربي يوضح الجاهزية والاعتماد قبل النشر.
 */
import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { EmptyWorkspace, MetricCard, PageHero, StatusPill, WorkspaceCard } from "@/components/platform/ops-ui";

type Platform = "FACEBOOK" | "INSTAGRAM" | "LINKEDIN" | "TIKTOK" | "YOUTUBE" | "X";
type Channel = { id: string; platform: Platform; externalId: string; displayName: string; accountType: string | null; status: "CONFIGURATION_REQUIRED" | "READY" | "NEEDS_REAUTH" | "RESTRICTED" | "DISCONNECTED" | "ERROR"; scopes: string[]; capabilities: { notes?: string[] }; reauthReason: string | null; metadata: Record<string, unknown> | null; lastSyncedAt: string | null };
type Variant = { id: string; platform: Platform; copy: string; assetUrls: string[]; status: string; connectedChannel: Pick<Channel, "id" | "displayName" | "platform" | "status">; publicationPlans: Array<{ id: string; scheduledAt: string | null; status: string }> };
type ContentItem = { id: string; title: string; body: string; type: string; status: string; tags: string[]; assetUrls: string[]; updatedAt: string; campaign: { id: string; title: string } | null; variants: Variant[]; _count?: { aiProposals: number } };
type Plan = { id: string; scheduledAt: string | null; timezone: string; status: string; channelVariant: { id: string; copy: string; contentItem: { id: string; title: string; type: string }; connectedChannel: Pick<Channel, "id" | "displayName" | "platform" | "status"> } };
type Campaign = { id: string; title: string; objective: string | null; startDate: string | null; endDate: string | null; _count: { contentItems: number } };
type Brand = { tone: string | null; preferredTerms: string[]; forbiddenTerms: string[]; officialHashtags: string[]; contactInformation: string | null; defaultCta: string | null; identityNotes: string | null };
type ChannelMetric = { id: string; metric: string; value: number; collectedAt: string; connectedChannel: Pick<Channel, "id" | "displayName" | "platform"> };

const platformInfo: Record<Platform, { label: string; mark: string; description: string }> = {
  FACEBOOK: { label: "Facebook Pages", mark: "f", description: "صفحات الجمعية ومنشورات المجتمع" },
  INSTAGRAM: { label: "Instagram Professional", mark: "◎", description: "حساب احترافي ووسائط مرئية" },
  LINKEDIN: { label: "LinkedIn Pages", mark: "in", description: "واجهة الشركاء والقطاع غير الربحي" },
  TIKTOK: { label: "TikTok", mark: "♪", description: "فيديو وصور قصيرة بصلاحيات منشورة" },
  YOUTUBE: { label: "YouTube", mark: "▶", description: "فيديوهات الجمعية وتقارير الأثر" },
  X: { label: "X", mark: "𝕏", description: "إعلانات سريعة وتحديثات رسمية" },
};

const viewMeta = {
  overview: { eyebrow: "COMMUNICATIONS · COMMAND CENTER", title: "مركز الاتصال والنشر الرقمي", description: "من نقطة تشغيل واحدة: حرّر المحتوى، اعتمده، ثم وزّعه على قنوات الجمعية ضمن سجل واضح للقرار والنشر." },
  channels: { eyebrow: "COMMUNICATIONS · CHANNELS", title: "قنواتي الرقمية", description: "اربط الحسابات الرسمية من خلال التفويض المعتمد، وتابع صلاحية الاتصال وقدرات كل قناة قبل بدء النشر." },
  content: { eyebrow: "COMMUNICATIONS · EDITORIAL WORKSPACE", title: "استوديو المحتوى", description: "أنشئ أصلًا واحدًا ثم جهّز نسخًا مناسبة لكل قناة؛ لا يُنشر أي محتوى قبل المرور بالمراجعة والاعتماد." },
  calendar: { eyebrow: "COMMUNICATIONS · EDITORIAL CALENDAR", title: "تقويم النشر", description: "راجع الخطط المعتمدة ومواعيد النشر في توقيت الرياض، مع تنبيه واضح إذا لم يكن عامل الجدولة الإنتاجي متاحًا." },
  campaigns: { eyebrow: "COMMUNICATIONS · CAMPAIGNS", title: "حملات الاتصال", description: "نظّم القصص والمبادرات حول هدف اتصالي مشترك، مع إمكانية ربطها بمصدر عمليات أو حملة تبرعات داخلية." },
  brand: { eyebrow: "COMMUNICATIONS · BRAND KIT", title: "هوية الاتصال", description: "اضبط لغة الجمعية ومصطلحاتها ووسومها المعتمدة لتظهر النسخ التحريرية بروح واحدة عبر القنوات." },
} as const;

function statusVisual(status: string) {
  const labels: Record<string, [string, "teal" | "amber" | "rose" | "slate"]> = {
    READY: ["جاهزة", "teal"], CONFIGURATION_REQUIRED: ["تحتاج إعدادًا", "amber"], NEEDS_REAUTH: ["تحتاج إعادة ربط", "rose"], RESTRICTED: ["مقيدة", "rose"], DISCONNECTED: ["مفصولة", "slate"], ERROR: ["تحتاج فحصًا", "rose"],
    DRAFT: ["مسودة", "slate"], IN_REVIEW: ["قيد المراجعة", "amber"], CHANGES_REQUESTED: ["مطلوب تعديل", "rose"], APPROVED: ["معتمدة", "teal"], SCHEDULED: ["مجدولة", "teal"], PUBLISHING: ["جارٍ النشر", "amber"], PUBLISHED: ["منشورة", "teal"], FAILED: ["فشل النشر", "rose"], CANCELLED: ["ملغاة", "slate"],
  };
  return labels[status] || [status, "slate"] as [string, "slate"];
}

function dateLabel(value?: string | null) {
  return value ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(value)) : "لم يحدد";
}

export function CommunicationsHub({ view = "overview" }: { view?: keyof typeof viewMeta }) {
  const [channels, setChannels] = React.useState<Channel[]>([]);
  const [content, setContent] = React.useState<ContentItem[]>([]);
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [brand, setBrand] = React.useState<Brand | null>(null);
  const [metrics, setMetrics] = React.useState<ChannelMetric[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [durableQueue, setDurableQueue] = React.useState(false);
  const [showComposer, setShowComposer] = React.useState(view === "content");
  const [selectedVariant, setSelectedVariant] = React.useState<Variant | null>(null);
  const [scheduleAt, setScheduleAt] = React.useState("");
  const { addToast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const responses = await Promise.all([fetch("/api/communications/channels"), fetch("/api/communications/content"), fetch("/api/communications/plans"), fetch("/api/communications/campaigns"), fetch("/api/communications/brand"), fetch("/api/communications/metrics")]);
      const data = await Promise.all(responses.map((response) => response.json()));
      const failed = responses.findIndex((response) => !response.ok);
      if (failed >= 0) throw new Error(data[failed].error || "تعذر تحميل بيانات مركز الاتصال.");
      setChannels(data[0].channels || []); setContent(data[1].content || []); setPlans(data[2].plans || []); setDurableQueue(Boolean(data[2].durableQueue)); setCampaigns(data[3].campaigns || []); setBrand(data[4].brand || null); setMetrics(data[5].latest || []);
    } catch (error) {
      addToast({ type: "error", title: "تعذر تحميل المركز", description: error instanceof Error ? error.message : "حاول إعادة تحميل الصفحة." });
    } finally { setLoading(false); }
  }, [addToast]);

  React.useEffect(() => { void load(); }, [load]);

  async function api(url: string, options?: RequestInit) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "تعذر إكمال العملية.");
    return data;
  }

  async function disconnectChannel(channel: Channel) {
    try {
      await api(`/api/communications/channels/${channel.id}/disconnect`, { method: "POST" });
      addToast({ type: "success", title: "تم فصل القناة", description: `تم إيقاف اتصال ${channel.displayName} ويمكن ربطها من جديد عند الحاجة.` });
      await load();
    } catch (error) { addToast({ type: "error", title: "تعذر فصل القناة", description: error instanceof Error ? error.message : "حاول لاحقًا." }); }
  }

  async function syncMetrics() {
    try {
      const result = await api("/api/communications/metrics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      addToast({ type: result.failures?.length ? "warning" : "success", title: "اكتملت مزامنة المؤشرات", description: result.failures?.length ? `تمت مزامنة ${result.succeeded} قناة، وتعذر تحديث ${result.failures.length} قناة بسبب صلاحيات أو إعدادات مزودها.` : `تمت مزامنة ${result.succeeded} قناة جاهزة.` });
      await load();
    } catch (error) { addToast({ type: "error", title: "تعذرت مزامنة المؤشرات", description: error instanceof Error ? error.message : "راجع اتصال القنوات وصلاحيات التحليلات." }); }
  }

  async function createCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try {
      await api("/api/communications/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: form.get("title"), objective: form.get("objective") || undefined, startDate: form.get("startDate") ? new Date(String(form.get("startDate"))).toISOString() : undefined, endDate: form.get("endDate") ? new Date(String(form.get("endDate"))).toISOString() : undefined }) });
      event.currentTarget.reset(); addToast({ type: "success", title: "تم إنشاء حملة الاتصال", description: "يمكنك الآن ربط الأصول التحريرية بها." }); await load();
    } catch (error) { addToast({ type: "error", title: "تعذر إنشاء الحملة", description: error instanceof Error ? error.message : "راجع الحقول المطلوبة." }); }
  }

  async function createContent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const selected = channels.filter((channel) => form.get(`channel-${channel.id}`) === "on" && channel.status === "READY");
    const assetUrls = String(form.get("assetUrls") || "").split("\n").map((item) => item.trim()).filter(Boolean);
    try {
      await api("/api/communications/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: form.get("title"), body: form.get("body"), type: form.get("type"), tags: String(form.get("tags") || "").split(/[,،]/).map((item) => item.trim()).filter(Boolean), assetUrls, campaignId: String(form.get("campaignId") || "") || undefined, targets: selected.map((channel) => ({ channelId: channel.id, copy: String(form.get(`copy-${channel.id}`) || form.get("body") || ""), assetUrls })) }) });
      event.currentTarget.reset(); setShowComposer(false); addToast({ type: "success", title: "تم إنشاء أصل المحتوى", description: "النسخ الجديدة بقيت مسودات؛ أرسلها للمراجعة عند اكتمالها." }); await load();
    } catch (error) { addToast({ type: "error", title: "تعذر حفظ المحتوى", description: error instanceof Error ? error.message : "اختر قناة جاهزة وأكمل النص." }); }
  }

  async function reviewVariant(variant: Variant, decision: "SUBMIT" | "APPROVE" | "REQUEST_CHANGES") {
    try {
      await api(`/api/communications/variants/${variant.id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
      addToast({ type: "success", title: decision === "SUBMIT" ? "تم إرسال النسخة للمراجعة" : decision === "APPROVE" ? "تم اعتماد النسخة" : "تمت إعادة النسخة للتعديل", description: "سجل القرار في ملف المحتوى." }); await load();
    } catch (error) { addToast({ type: "error", title: "تعذر تحديث المراجعة", description: error instanceof Error ? error.message : "حاول لاحقًا." }); }
  }

  async function planPublication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedVariant) return;
    try {
      await api("/api/communications/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelVariantId: selectedVariant.id, scheduledAt: scheduleAt ? new Date(scheduleAt).toISOString() : undefined, timezone: "Asia/Riyadh" }) });
      setSelectedVariant(null); setScheduleAt(""); addToast({ type: "success", title: scheduleAt ? "تمت الجدولة" : "الخطة جاهزة للنشر", description: scheduleAt ? "أضيف الموعد إلى تقويم النشر." : "راجعها ثم اضغط نشر فورًا عند الاستعداد." }); await load();
    } catch (error) { addToast({ type: "error", title: "تعذر إنشاء خطة النشر", description: error instanceof Error ? error.message : "حاول لاحقًا." }); }
  }

  async function saveBrand(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const list = (name: string) => String(form.get(name) || "").split(/[,،\n]/).map((item) => item.trim()).filter(Boolean);
    try {
      await api("/api/communications/brand", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tone: form.get("tone") || undefined, preferredTerms: list("preferredTerms"), forbiddenTerms: list("forbiddenTerms"), officialHashtags: list("officialHashtags"), contactInformation: form.get("contactInformation") || undefined, defaultCta: form.get("defaultCta") || undefined, identityNotes: form.get("identityNotes") || undefined }) });
      addToast({ type: "success", title: "تم حفظ هوية الاتصال", description: "ستظهر الإرشادات في مقترحات محرر المحتوى." }); await load();
    } catch (error) { addToast({ type: "error", title: "تعذر حفظ الهوية", description: error instanceof Error ? error.message : "راجع الحقول." }); }
  }

  const readyChannels = channels.filter((channel) => channel.status === "READY");
  const pendingReviews = content.flatMap((item) => item.variants).filter((variant) => variant.status === "IN_REVIEW").length;
  const scheduledPlans = plans.filter((plan) => plan.status === "SCHEDULED").length;
  const metricLabel: Record<string, string> = { VIEWS: "مشاهدات", REACH: "وصول", ENGAGEMENT: "تفاعل", LIKES: "إعجابات", COMMENTS: "تعليقات", SHARES: "مشاركات", CLICKS: "نقرات", FOLLOWERS: "متابعون", VIDEO_VIEWS: "فيديوهات" };
  const meta = viewMeta[view];

  return <div className="space-y-6">
    <PageHero eyebrow={meta.eyebrow} title={meta.title} description={meta.description} actions={<div className="flex flex-wrap gap-2"><Link href="/communications/channels"><Button variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">القنوات</Button></Link><Link href="/communications/content"><Button variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">المحتوى</Button></Link><Link href="/communications/calendar"><Button variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">التقويم</Button></Link><Link href="/communications/brand"><Button className="bg-white text-teal-800 hover:bg-teal-50">هوية الاتصال</Button></Link></div>} />
    {loading ? <div className="rounded-xl border bg-white p-10 text-center text-sm text-muted-foreground">جارٍ تجهيز سجل الاتصال للجمعية النشطة…</div> : <>
      {(view === "overview" || view === "channels") && <section className="space-y-4">
        {view === "overview" && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="قنوات جاهزة" value={readyChannels.length} detail={`من أصل ${channels.length} قناة مرتبطة`} tone="teal" /><MetricCard label="بانتظار المراجعة" value={pendingReviews} detail="نسخ تحتاج قرار اعتماد" tone="amber" /><MetricCard label="خطط مجدولة" value={scheduledPlans} detail="في تقويم الرياض" tone="slate" /><MetricCard label="أصول منشورة" value={content.flatMap((item) => item.variants).filter((variant) => variant.status === "PUBLISHED").length} detail="نسخ تم نشرها بنجاح" tone="teal" /></div>}
        {view === "overview" && <WorkspaceCard title="ملخص أداء القنوات" description="لقطات المؤشرات تأتي من الواجهات الرسمية المتاحة لكل قناة وصلاحياتها؛ لا تُعرض أرقام تقديرية عند غياب التفويض." status={<Button size="sm" variant="outline" onClick={() => void syncMetrics()} disabled={!readyChannels.length}>مزامنة المؤشرات</Button>}><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.length ? metrics.slice(0, 8).map((metric) => <div key={metric.id} className="rounded-lg border bg-slate-50/70 p-3"><p className="text-xs text-muted-foreground">{metric.connectedChannel.displayName} · {metricLabel[metric.metric] || metric.metric}</p><p className="mt-1 text-xl font-bold text-slate-900">{new Intl.NumberFormat("ar-SA").format(metric.value)}</p><p className="mt-1 text-xs text-muted-foreground">آخر لقطة {dateLabel(metric.collectedAt)}</p></div>) : <p className="text-sm text-muted-foreground sm:col-span-2 xl:col-span-4">لا توجد لقطات بعد. بعد ربط قناة ذات صلاحية تحليلات، استخدم مزامنة المؤشرات لجلب البيانات المتاحة.</p>}</div></WorkspaceCard>}
        {channels.length === 0 && <EmptyWorkspace title="ابدأ بربط قناة رسمية" description="لا تحفظ المنصة كلمات مرور القنوات. يبدأ الربط بتفويض OAuth لدى كل مزود، ثم تحفظ الرموز مشفرة في الخادم." action={<Link href="/communications/channels"><Button>إدارة القنوات</Button></Link>} />}
        {(view === "channels" || view === "overview") && <div className="grid gap-4 xl:grid-cols-2">{(Object.keys(platformInfo) as Platform[]).map((platform) => { const matching = channels.filter((channel) => channel.platform === platform); const detail = platformInfo[platform]; return <WorkspaceCard key={platform} title={detail.label} description={detail.description} status={<span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-50 font-bold text-teal-800">{detail.mark}</span>} meta={matching.length ? `${matching.length} قناة مسجلة` : "لم تربط قناة بعد"}><div className="space-y-3">{matching.map((channel) => { const [label, tone] = statusVisual(channel.status); return <div key={channel.id} className="flex items-center justify-between gap-3 rounded-lg border bg-slate-50/70 p-3"><div><p className="text-sm font-bold text-slate-900">{channel.displayName}</p><p className="mt-1 text-xs text-muted-foreground">{channel.accountType || "حساب رسمي"}{channel.reauthReason ? ` · ${channel.reauthReason}` : ""}</p></div><div className="flex items-center gap-2"><StatusPill label={label} tone={tone} /><button type="button" className="text-xs font-bold text-rose-700 hover:text-rose-900" onClick={() => void disconnectChannel(channel)}>فصل</button></div></div>; })}<Link href={`/api/integrations/${platform.toLowerCase()}/start`} className="inline-flex text-sm font-bold text-teal-700 hover:text-teal-900">{matching.length ? "ربط حساب إضافي ←" : "ربط الحساب الرسمي ←"}</Link></div></WorkspaceCard>; })}</div>}
      </section>}
      {(view === "overview" || view === "content") && <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">مسار التأليف والاعتماد</h2><p className="mt-1 text-sm text-muted-foreground">المسودة ← المراجعة ← الاعتماد ← الجدولة أو النشر.</p></div><Button onClick={() => setShowComposer((value) => !value)} disabled={!readyChannels.length}>{showComposer ? "إغلاق المحرر" : "إنشاء محتوى"}</Button></div>
        {!readyChannels.length && <WorkspaceCard title="اربط قناة جاهزة أولًا" description="يتطلب إنشاء نسخة قابلة للمراجعة اختيار قناة رسمية مرتبطة وجاهزة." status={<StatusPill label="خطوة لازمة" tone="amber" />}><Link href="/communications/channels" className="text-sm font-bold text-teal-700">الذهاب إلى القنوات ←</Link></WorkspaceCard>}
        {showComposer && <WorkspaceCard title="أصل محتوى جديد" description="أدخل الرسالة الأساسية ثم حدد القنوات التي تحتاج نسخة منها. يمكنك تعديل صياغة كل قناة لاحقًا من سجل المحتوى." status={<StatusPill label="مسودة" tone="slate" />}><form className="grid gap-4" onSubmit={createContent}><div className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><Label htmlFor="title">عنوان العمل التحريري</Label><Input id="title" name="title" className="mt-1" required placeholder="مثال: إطلاق مبادرة سقيا الشتاء" /></div><div><Label htmlFor="type">نوع المحتوى</Label><select id="type" name="type" className="mt-1 flex h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="NEWS">خبر</option><option value="EVENT">فعالية</option><option value="PROJECT">مشروع</option><option value="DONATION_CAMPAIGN">حملة تبرع</option><option value="ACHIEVEMENT">إنجاز</option><option value="SUCCESS_STORY">قصة أثر</option><option value="INDEPENDENT">محتوى مستقل</option></select></div><div><Label htmlFor="campaignId">حملة اتصال (اختياري)</Label><select id="campaignId" name="campaignId" className="mt-1 flex h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">دون حملة محددة</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}</select></div></div><div><Label htmlFor="body">الرسالة الأساسية</Label><Textarea id="body" name="body" className="mt-1" rows={6} required placeholder="اكتب الحقائق المعتمدة والرسالة التي تريد نقلها. تجنب أي بيانات تعريفية للمستفيدين." /></div><div className="grid gap-4 md:grid-cols-2"><div><Label htmlFor="tags">الوسوم والكلمات المفتاحية</Label><Input id="tags" name="tags" className="mt-1" placeholder="#جمعية_أساس، مبادرة، أثر" /></div><div><Label htmlFor="assetUrls">روابط وسائط عامة</Label><Textarea id="assetUrls" name="assetUrls" className="mt-1" rows={2} placeholder="رابط واحد في كل سطر" /></div></div><div className="rounded-lg border bg-slate-50/70 p-4"><p className="text-sm font-bold text-slate-900">نسخ القنوات المستهدفة</p><p className="mt-1 text-xs text-muted-foreground">اختر القناة ثم أضف صياغة خاصة بها عند الحاجة. ستستخدم الرسالة الأساسية افتراضيًا.</p><div className="mt-3 grid gap-3 md:grid-cols-2">{readyChannels.map((channel) => <label key={channel.id} className="rounded-md border bg-white p-3"><span className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name={`channel-${channel.id}`} className="h-4 w-4 accent-teal-700" /> {platformInfo[channel.platform].label} · {channel.displayName}</span><Textarea name={`copy-${channel.id}`} rows={2} className="mt-2 text-sm" placeholder="نسخة مخصصة (اختياري)" /></label>)}</div></div><div className="flex justify-end"><Button type="submit">حفظ الأصل والنسخ</Button></div></form></WorkspaceCard>}
        {content.length === 0 ? <EmptyWorkspace title="لا توجد مسودات تحريرية بعد" description="أنشئ أصل محتوى مرتبطًا بمبادرة أو خبر أو قصة أثر، ثم مرره على القنوات الملائمة." action={readyChannels.length ? <Button onClick={() => setShowComposer(true)}>إنشاء أول محتوى</Button> : undefined} /> : <div className="grid gap-4 xl:grid-cols-2">{content.slice(0, view === "overview" ? 6 : 30).map((item) => <WorkspaceCard key={item.id} title={item.title} description={item.body.length > 150 ? `${item.body.slice(0, 150)}…` : item.body} status={<StatusPill label={statusVisual(item.status)[0]} tone={statusVisual(item.status)[1]} />} meta={`${item.campaign?.title || "محتوى مستقل"} · آخر تعديل ${dateLabel(item.updatedAt)}`}><div className="space-y-2">{item.variants.map((variant) => { const [label, tone] = statusVisual(variant.status); return <div key={variant.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-slate-50/70 p-3"><div><p className="text-sm font-bold text-slate-800">{platformInfo[variant.platform].label} · {variant.connectedChannel.displayName}</p><p className="mt-1 text-xs text-muted-foreground">{variant.copy.length > 100 ? `${variant.copy.slice(0, 100)}…` : variant.copy}</p></div><div className="flex flex-wrap items-center gap-2"><StatusPill label={label} tone={tone} />{variant.status === "DRAFT" || variant.status === "CHANGES_REQUESTED" ? <button type="button" onClick={() => void reviewVariant(variant, "SUBMIT")} className="text-xs font-bold text-teal-700">إرسال للمراجعة</button> : null}{variant.status === "IN_REVIEW" ? <><button type="button" onClick={() => void reviewVariant(variant, "APPROVE")} className="text-xs font-bold text-teal-700">اعتماد</button><button type="button" onClick={() => void reviewVariant(variant, "REQUEST_CHANGES")} className="text-xs font-bold text-rose-700">طلب تعديل</button></> : null}{variant.status === "APPROVED" ? <button type="button" onClick={() => setSelectedVariant(variant)} className="text-xs font-bold text-teal-700">جدولة / نشر</button> : null}</div></div>; })}</div></WorkspaceCard>)}</div>}
      </section>}
      {selectedVariant && <WorkspaceCard title={`خطة نشر: ${selectedVariant.connectedChannel.displayName}`} description="اختر موعدًا مستقبليًا للجدولة أو اتركه فارغًا لإنشاء خطة جاهزة للنشر الفوري. جميع المواعيد بتوقيت الرياض." status={<button type="button" onClick={() => setSelectedVariant(null)} className="text-sm font-bold text-slate-500">إغلاق</button>}><form onSubmit={planPublication} className="grid gap-4 md:grid-cols-[1fr_auto]"><div><Label htmlFor="scheduledAt">موعد النشر (اختياري)</Label><Input id="scheduledAt" type="datetime-local" className="mt-1" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} /><p className="mt-1 text-xs text-muted-foreground">{durableQueue ? "عامل الجدولة متاح للنشر المؤجل." : "لا تتوفر جدولة متينة في هذه البيئة؛ أنشئ خطة جاهزة للنشر الفوري فقط."}</p></div><div className="self-end"><Button type="submit" disabled={Boolean(scheduleAt) && !durableQueue}>{scheduleAt ? "تأكيد الجدولة" : "إنشاء خطة جاهزة"}</Button></div></form></WorkspaceCard>}
      {(view === "overview" || view === "calendar") && <section className="space-y-4"><div><h2 className="text-lg font-bold text-slate-900">تقويم النشر</h2><p className="mt-1 text-sm text-muted-foreground">خطط النشر المعتمدة أو المجدولة وسجل حالة الإرسال.</p></div>{plans.length === 0 ? <EmptyWorkspace title="لا توجد خطط نشر بعد" description="اعتمد نسخة قناة من استوديو المحتوى ثم أضفها إلى التقويم." /> : <div className="grid gap-3">{plans.slice(0, view === "overview" ? 8 : 60).map((plan) => { const [label, tone] = statusVisual(plan.status); return <WorkspaceCard key={plan.id} title={plan.channelVariant.contentItem.title} description={`${platformInfo[plan.channelVariant.connectedChannel.platform].label} · ${plan.channelVariant.connectedChannel.displayName}`} status={<StatusPill label={label} tone={tone} />} meta={`الموعد: ${dateLabel(plan.scheduledAt)} · ${plan.timezone}`}><p className="text-sm text-slate-700">{plan.channelVariant.copy.length > 220 ? `${plan.channelVariant.copy.slice(0, 220)}…` : plan.channelVariant.copy}</p></WorkspaceCard>; })}</div>}</section>}
      {view === "campaigns" && <section className="space-y-4"><WorkspaceCard title="حملة اتصال جديدة" description="حدد هدفًا اتصاليًا واضحًا. يمكن ربط المصادر الداخلية لاحقًا دون خلطها بعمليات التبرع." status={<StatusPill label="تخطيط" tone="amber" />}><form onSubmit={createCampaign} className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><Label htmlFor="campaignTitle">اسم الحملة</Label><Input id="campaignTitle" name="title" className="mt-1" required placeholder="مثال: رحلة الأثر في رمضان" /></div><div className="md:col-span-2"><Label htmlFor="objective">الهدف الاتصالي</Label><Textarea id="objective" name="objective" rows={3} className="mt-1" placeholder="ما الذي يجب أن يفهمه أو يفعله الجمهور؟" /></div><div><Label htmlFor="startDate">البداية</Label><Input id="startDate" name="startDate" type="datetime-local" className="mt-1" /></div><div><Label htmlFor="endDate">النهاية</Label><Input id="endDate" name="endDate" type="datetime-local" className="mt-1" /></div><div className="md:col-span-2 flex justify-end"><Button type="submit">إنشاء الحملة</Button></div></form></WorkspaceCard>{campaigns.length ? <div className="grid gap-4 xl:grid-cols-2">{campaigns.map((campaign) => <WorkspaceCard key={campaign.id} title={campaign.title} description={campaign.objective || "لم يكتب فريق العمل هدف الحملة بعد."} status={<StatusPill label={`${campaign._count.contentItems} أصول`} tone="teal" />} meta={`من ${dateLabel(campaign.startDate)} إلى ${dateLabel(campaign.endDate)}`} />)}</div> : <EmptyWorkspace title="لا توجد حملات اتصال" description="استخدم الحملة لربط سلسلة القصص والأخبار والمحتوى متعدد القنوات حول هدف واحد." />}</section>}
      {view === "brand" && <section><WorkspaceCard title="إرشادات صوت الجمعية" description="هذه بيانات تحريرية فقط. لا تدخل مفاتيح القنوات أو أسرار التطبيقات في هذا النموذج." status={<StatusPill label="محلي للجمعية" tone="teal" />}><form onSubmit={saveBrand} className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><Label htmlFor="tone">نبرة الخطاب</Label><Input id="tone" name="tone" defaultValue={brand?.tone || ""} className="mt-1" placeholder="رصينة، واضحة، قريبة من المجتمع، ومبنية على الأثر" /></div><div><Label htmlFor="preferredTerms">مصطلحات مفضلة</Label><Textarea id="preferredTerms" name="preferredTerms" defaultValue={(brand?.preferredTerms || []).join("، ")} rows={3} className="mt-1" placeholder="أثر، تمكين، مجتمع، شراكة" /></div><div><Label htmlFor="forbiddenTerms">مصطلحات ممنوعة أو حساسة</Label><Textarea id="forbiddenTerms" name="forbiddenTerms" defaultValue={(brand?.forbiddenTerms || []).join("، ")} rows={3} className="mt-1" placeholder="مصطلحات ترفضها سياسة الجمعية" /></div><div><Label htmlFor="officialHashtags">وسوم رسمية</Label><Textarea id="officialHashtags" name="officialHashtags" defaultValue={(brand?.officialHashtags || []).join("، ")} rows={3} className="mt-1" placeholder="#جمعية_أساس، #أثر_مستدام" /></div><div><Label htmlFor="defaultCta">دعوة افتراضية للفعل</Label><Textarea id="defaultCta" name="defaultCta" defaultValue={brand?.defaultCta || ""} rows={3} className="mt-1" placeholder="تواصلوا معنا أو اطلعوا على تفاصيل المبادرة" /></div><div className="md:col-span-2"><Label htmlFor="contactInformation">معلومات التواصل المعتمدة</Label><Textarea id="contactInformation" name="contactInformation" defaultValue={brand?.contactInformation || ""} rows={2} className="mt-1" placeholder="البريد، الهاتف، الرابط الرسمي الذي يحق للفريق إدراجه." /></div><div className="md:col-span-2"><Label htmlFor="identityNotes">ملاحظات وهوية بصرية</Label><Textarea id="identityNotes" name="identityNotes" defaultValue={brand?.identityNotes || ""} rows={4} className="mt-1" placeholder="تعليمات حول استخدام الشعار أو الألوان أو العبارة التعريفية." /></div><div className="md:col-span-2 flex justify-end"><Button type="submit">حفظ الإرشادات</Button></div></form></WorkspaceCard></section>}
    </>}
  </div>;
}
