import { getEventById } from "@/modules/events/events";
import { EventForm } from "../../_components/event-form";
import { notFound } from "next/navigation";

type EditEventPageProps = {
  params: {
    id: string;
  };
};

export default async function EditEventPage({ params }: EditEventPageProps) {
  const event = await getEventById(params.id);

  if (!event) {
    notFound();
  }

  return (
    <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <EventForm initialData={event} />
    </main>
  );
}