import { readFlash } from "@/lib/flash";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/SubmitButton";
import { Turnstile } from "@/components/Turnstile";
import { Field, Notice } from "@/components/ui";
import { submitFeedback } from "@/app/actions";

export const metadata = { title: "Event feedback" };

export default async function FeedbackPage({ params, searchParams }: PageProps<"/events/[id]/feedback">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("id, title, starts_at, status").eq("id", id).maybeSingle();
  if (!event || event.status !== "published") notFound();

  const open = new Date(event.starts_at) <= new Date();
  const action = submitFeedback.bind(null, event.id);
  const done = typeof sp.ok === "string";

  return (
    <div className="mx-auto max-w-lg">
      <Link href={`/events/${event.id}`} className="text-sm text-brand hover:underline">← {event.title}</Link>
      <h1 className="mb-4 mt-2 text-2xl font-bold">Feedback</h1>
      <Notice {...readFlash(sp)} />
      {!open ? (
        <p className="text-sm text-muted">Feedback opens once the event starts.</p>
      ) : done ? null : (
        <form action={action} className="card space-y-4">
          <fieldset>
            <legend className="label">Rating *</legend>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="cursor-pointer">
                  <input type="radio" name="rating" value={n} required className="peer sr-only" />
                  <span className="grid size-11 place-items-center rounded-lg border border-line text-lg peer-checked:border-brand peer-checked:bg-brand peer-checked:text-brand-fg peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40">{n}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">1 = poor, 5 = excellent</p>
          </fieldset>
          <Field label="Your email * (one response per person)"><input name="email" type="email" required className="input" /></Field>
          <Field label="Name (optional)"><input name="full_name" maxLength={120} className="input" /></Field>
          <Field label="Comments"><textarea name="comment" rows={4} maxLength={2000} className="input" /></Field>
          <Turnstile action="feedback" />
          <SubmitButton pendingText="Sending…">Submit feedback</SubmitButton>
        </form>
      )}
    </div>
  );
}
