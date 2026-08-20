import { getPageById } from "@/modules/content/pages";
import { ContentForm } from "../../_components/content-form";
import { notFound } from "next/navigation";

type EditContentPageProps = {
  params: {
    id: string;
  };
};

export default async function EditContentPage({ params }: EditContentPageProps) {
  const page = await getPageById(params.id);

  if (!page) {
    notFound();
  }

  return (
    <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <ContentForm initialData={page} />
    </main>
  );
}