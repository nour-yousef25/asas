import { getPageById } from "@/modules/content/pages";
import { notFound } from "next/navigation";
import EditContentForm from "./_edit-form";

export default async function EditContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await getPageById(id);
  if (!page) notFound();
  return <EditContentForm page={page} />;
}
