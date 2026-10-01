import { SubmitButton } from "@/components/SubmitButton";
import { Field } from "@/components/ui";
import { EVENT_CATEGORIES } from "@/lib/categories";
import { toLocalInput } from "@/lib/format";
import type { ClubEvent } from "@/lib/types";

const CATEGORIES = EVENT_CATEGORIES;

export function EventForm({ action, event }: { action: (fd: FormData) => Promise<void>; event?: ClubEvent }) {
  return (
    <form action={action} className="card grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><Field label="Title *"><input name="title" required maxLength={160} defaultValue={event?.title} className="input" /></Field></div>
      <Field label="Category">
        <select name="category" defaultValue={event?.category ?? "Workshop"} className="input">
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Venue"><input name="venue" maxLength={160} defaultValue={event?.venue ?? ""} className="input" /></Field>
      <Field label="Starts *" hint="India time (IST)"><input name="starts_at" type="datetime-local" required defaultValue={toLocalInput(event?.starts_at)} className="input" /></Field>
      <Field label="Ends"><input name="ends_at" type="datetime-local" defaultValue={toLocalInput(event?.ends_at)} className="input" /></Field>
      <div className="sm:col-span-2"><Field label="Description"><textarea name="description" rows={4} maxLength={4000} defaultValue={event?.description ?? ""} className="input" /></Field></div>

      <Field label="Capacity" hint="Leave empty for unlimited"><input name="capacity" type="number" min={1} defaultValue={event?.capacity ?? ""} className="input" /></Field>
      <Field label="Status">
        <select name="status" defaultValue={event?.status ?? "published"} className="input">
          <option value="published">Published (visible to everyone)</option>
          <option value="draft">Draft (hidden)</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </Field>

      <Field label="External registration form" hint="e.g. Google Form link. Optional — the built-in form works too."><input name="registration_url" defaultValue={event?.registration_url ?? ""} className="input" placeholder="https://forms.gle/…" /></Field>
      <Field label="External feedback form" hint="Optional — built-in quick feedback is always available after the event starts."><input name="feedback_url" defaultValue={event?.feedback_url ?? ""} className="input" placeholder="https://forms.gle/…" /></Field>

      <Field label="Budget allocated (₹)"><input name="budget_allocated" type="number" min={0} step="0.01" defaultValue={event?.budget_allocated ?? 0} className="input" /></Field>
      <Field label="Budget spent (₹)"><input name="budget_spent" type="number" min={0} step="0.01" defaultValue={event?.budget_spent ?? 0} className="input" /></Field>

      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="registration_open" defaultChecked={event?.registration_open ?? true} /> Registration open
      </label>
      <div className="sm:col-span-2"><SubmitButton>{event ? "Save changes" : "Create event"}</SubmitButton></div>
    </form>
  );
}
