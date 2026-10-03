import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConfirmButton, SubmitButton } from "@/components/SubmitButton";
import { Empty, Field, Notice, PageHeader } from "@/components/ui";
import { assignLeadAction, createLeadAction, resetLeadPasswordAction, unassignLeadAction } from "@/app/dashboard/actions";

export const metadata = { title: "Club leads" };

type LeadRow = { id: string; full_name: string | null; email: string | null; role: string; club_leads: { club_id: string; clubs: { name: string } | null }[] };

export default async function LeadsPage({ searchParams }: PageProps<"/dashboard/leads">) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: clubs }, { data: people }] = await Promise.all([
    supabase.from("clubs").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name, email, role, club_leads(club_id, clubs(name))").order("email"),
  ]);
  const clubList = (clubs ?? []) as { id: string; name: string }[];
  const leads = ((people ?? []) as unknown as LeadRow[]).filter((p) => p.role === "club_lead");

  return (
    <>
      <PageHeader title="Club leads" subtitle="Accounts that can manage their own club's events, participants and members." />
      <Notice ok={typeof sp.ok === "string" ? sp.ok : undefined} error={typeof sp.error === "string" ? sp.error : undefined} />

      <details className="card mb-6" open={leads.length === 0}>
        <summary className="cursor-pointer font-semibold">Create a club lead account</summary>
        <form action={createLeadAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><input name="full_name" className="input" /></Field>
          <Field label="Email *"><input name="email" type="email" required className="input" /></Field>
          <Field label="Temporary password *" hint="Min 8 characters. Share it with the lead — they can keep using it."><input name="password" type="text" minLength={8} required className="input" autoComplete="off" /></Field>
          <fieldset className="sm:col-span-2">
            <legend className="label">Manages</legend>
            <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-line p-3 sm:grid-cols-2">
              {clubList.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="clubs" value={c.id} /> {c.name}</label>
              ))}
            </div>
          </fieldset>
          <div className="sm:col-span-2"><SubmitButton pendingText="Creating…">Create account</SubmitButton></div>
        </form>
      </details>

      {leads.length === 0 ? (
        <Empty>No club leads yet.</Empty>
      ) : (
        <div className="space-y-3">
          {leads.map((l) => {
            const assigned = new Set(l.club_leads.map((c) => c.club_id));
            return (
              <div key={l.id} className="card">
                <div className="font-medium">{l.full_name ?? l.email}</div>
                <div className="text-sm text-muted">{l.email}</div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {l.club_leads.length === 0 && <span className="text-sm text-muted">No clubs assigned.</span>}
                  {l.club_leads.map((c) => (
                    <form key={c.club_id} action={unassignLeadAction.bind(null, l.id, c.club_id)}>
                      <ConfirmButton message={`Remove ${l.email} from ${c.clubs?.name}?`} className="badge gap-1.5 hover:bg-red-500/10">{c.clubs?.name} <span aria-label="remove">✕</span></ConfirmButton>
                    </form>
                  ))}
                </div>
                <form action={assignLeadAction} className="mt-3 flex gap-2">
                  <input type="hidden" name="user_id" value={l.id} />
                  <select name="club_id" className="input max-w-xs" defaultValue="" aria-label="Assign to club">
                    <option value="" disabled>Assign to club…</option>
                    {clubList.filter((c) => !assigned.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <SubmitButton className="btn" pendingText="…">Assign</SubmitButton>
                </form>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-muted hover:text-foreground">Reset password</summary>
                  <form action={resetLeadPasswordAction} className="mt-2 flex gap-2">
                    <input type="hidden" name="user_id" value={l.id} />
                    <input name="password" type="text" minLength={8} required autoComplete="off" placeholder="New password (min 8)" aria-label={`New password for ${l.email}`} className="input max-w-xs" />
                    <ConfirmButton message={`Reset the password for ${l.email}?`} className="btn">Reset</ConfirmButton>
                  </form>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
