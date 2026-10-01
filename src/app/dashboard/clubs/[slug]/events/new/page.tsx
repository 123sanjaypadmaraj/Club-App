import { requireClubAccess } from "@/lib/auth";
import { EventForm } from "@/components/EventForm";
import { Notice, PageHeader } from "@/components/ui";
import { saveEventAction } from "@/app/dashboard/actions";

export const metadata = { title: "New event" };

export default async function NewEvent({ params, searchParams }: PageProps<"/dashboard/clubs/[slug]/events/new">) {
  const { slug } = await params;
  const sp = await searchParams;
  await requireClubAccess(slug);
  return (
    <>
      <PageHeader title="New event" />
      <Notice error={typeof sp.error === "string" ? sp.error : undefined} />
      <EventForm action={saveEventAction.bind(null, slug, null)} />
    </>
  );
}
