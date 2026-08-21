import { getPageById } from "@/modules/content/pages";
import { notFound } from "next/navigation";
import { ContentPageForm } from "../../_components/content-page-form";

export default async function EditContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await getPageById(id);
  if (!page) notFound();
  return <ContentPageForm initialData={page} />;
}
