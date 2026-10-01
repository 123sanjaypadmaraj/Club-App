import { requireClubAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConfirmButton, SubmitButton } from "@/components/SubmitButton";
import { Empty, Field, Notice, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { addAnnouncementAction, deleteAnnouncementAction } from "@/app/dashboard/actions";
import type { Announcement } from "@/lib/types";

export const metadata = { title: "Announcements" };

export default async function AnnouncementsTab({ params, searchParams }: PageProps<"/dashboard/clubs/[slug]/announcements">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { club } = await requireClubAccess(slug);
  const supabase = await createClient();
  const { data } = await supabase.from("announcements").select("*").eq("club_id", club.id).order("pinned", { ascending: false }).order("created_at", { ascending: false });
  const items = (data as Announcement[]) ?? [];

  return (
    <>
      <PageHeader title="Announcements" subtitle="Shown on your public club page." />
      <Notice ok={typeof sp.ok === "string" ? sp.ok : undefined} error={typeof sp.error === "string" ? sp.error : undefined} />
      <form action={addAnnouncementAction.bind(null, slug)} className="card mb-6 space-y-3">
        <Field label="Title *"><input name="title" required maxLength={160} className="input" /></Field>
        <Field label="Message"><textarea name="body" rows={3} maxLength={2000} className="input" /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pinned" /> Pin to top</label>
        <SubmitButton pendingText="Posting…">Post announcement</SubmitButton>
      </form>
      {items.length === 0 ? <Empty>No announcements yet.</Empty> : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id} className="card flex items-start justify-between gap-4">
              <div>
                <h3 className="font-medium">{a.pinned && "📌 "}{a.title}</h3>
                <p className="text-xs text-muted">{fmtDate(a.created_at)}</p>
                {a.body && <p className="mt-1 whitespace-pre-line text-sm">{a.body}</p>}
              </div>
              <form action={deleteAnnouncementAction.bind(null, slug, a.id)}>
                <ConfirmButton message="Delete this announcement?" className="text-sm text-red-600 hover:underline">Delete</ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
