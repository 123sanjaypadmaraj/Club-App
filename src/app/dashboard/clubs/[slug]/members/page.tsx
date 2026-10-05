import { requireClubAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConfirmButton, SubmitButton } from "@/components/SubmitButton";
import { Empty, Field, Notice, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { filterMembers } from "@/lib/members";
import { pickFilter } from "@/lib/categories";
import { addMemberAction, importMembersAction, removeMemberAction, setMemberStatusAction } from "@/app/dashboard/actions";
import type { Member } from "@/lib/types";

export const metadata = { title: "Club members" };

export default async function MembersTab({ params, searchParams }: PageProps<"/dashboard/clubs/[slug]/members">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { club } = await requireClubAccess(slug);
  const supabase = await createClient();
  const { data } = await supabase.from("club_members").select("*").eq("club_id", club.id).order("status").order("full_name").limit(1000);
  const members = (data as Member[]) ?? [];
  const active = members.filter((m) => m.status === "active").length;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = pickFilter(sp.status, ["active", "alumni", "inactive"]);
  const shown = filterMembers(members, q, status);
  const filtered = Boolean(q || status);

  return (
    <>
      <PageHeader title="Members" subtitle={`${active} active · ${members.length} total`} actions={<a className="btn" href={`/dashboard/export/members?club=${slug}`}>Download CSV</a>} />
      <Notice ok={typeof sp.ok === "string" ? sp.ok : undefined} error={typeof sp.error === "string" ? sp.error : undefined} />

      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        <details className="card">
          <summary className="cursor-pointer text-sm font-medium">+ Add one member</summary>
          <form action={addMemberAction.bind(null, slug)} className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Name *"><input name="full_name" required maxLength={120} className="input" /></Field>
            <Field label="Email"><input name="email" type="email" maxLength={160} className="input" /></Field>
            <Field label="Roll no"><input name="roll_no" maxLength={40} className="input" /></Field>
            <Field label="Department"><input name="department" maxLength={80} className="input" /></Field>
            <Field label="Year"><input name="year" type="number" min={1} max={6} className="input" /></Field>
            <Field label="Phone"><input name="phone" maxLength={20} className="input" /></Field>
            <Field label="Position"><input name="position" defaultValue="Member" list="positions" maxLength={60} className="input" /></Field>
            <datalist id="positions">{["President", "Vice President", "Secretary", "Treasurer", "Core", "Member"].map((p) => <option key={p} value={p} />)}</datalist>
            <div className="sm:col-span-2"><SubmitButton className="btn btn-primary" pendingText="Adding…">Add member</SubmitButton></div>
          </form>
        </details>
        <details className="card">
          <summary className="cursor-pointer text-sm font-medium">⇪ Bulk import (paste from a spreadsheet)</summary>
          <form action={importMembersAction.bind(null, slug)} className="mt-3 space-y-3">
            <p className="text-xs text-muted">One member per line: <code>name, email, roll no, department, year, phone, position</code>. Only the name is required.</p>
            <textarea name="csv" rows={6} className="input font-mono" placeholder={"Asha Rao, asha@college.edu, 22CS101, CSE, 2, 9876543210, Core"} />
            <SubmitButton className="btn btn-primary" pendingText="Importing…">Import</SubmitButton>
          </form>
        </details>
      </div>

      {members.length > 0 && (
        <form method="get" className="mb-4 flex flex-wrap items-center gap-2" role="search">
          <input name="q" defaultValue={q} placeholder="Search name, email, roll no…" aria-label="Search members" className="input max-w-xs" />
          <select name="status" defaultValue={status} aria-label="Filter by status" className="input max-w-[10rem]">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="alumni">Alumni</option>
            <option value="inactive">Inactive</option>
          </select>
          <button className="btn" type="submit">Search</button>
          {filtered && <a className="text-sm text-brand hover:underline" href={`/dashboard/clubs/${slug}/members`}>Clear</a>}
          {filtered && <span className="text-sm text-muted">Showing {shown.length} of {members.length}</span>}
        </form>
      )}

      {members.length === 0 ? (
        <Empty>No members yet.</Empty>
      ) : shown.length === 0 ? (
        <Empty>No members match your search.</Empty>
      ) : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-line">
                <th className="th">Name</th><th className="th">Position</th><th className="th">Email</th><th className="th">Roll no</th>
                <th className="th">Dept</th><th className="th">Yr</th><th className="th">Joined</th><th className="th">Status</th><th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((m) => (
                <tr key={m.id} className={m.status === "active" ? "" : "opacity-60"}>
                  <td className="td font-medium">{m.full_name}</td>
                  <td className="td">{m.position}</td>
                  <td className="td text-muted">{m.email}</td>
                  <td className="td">{m.roll_no}</td>
                  <td className="td">{m.department}</td>
                  <td className="td">{m.year}</td>
                  <td className="td text-muted">{fmtDate(m.joined_on)}</td>
                  <td className="td">
                    <form action={setMemberStatusAction.bind(null, slug, m.id, m.status === "active" ? "alumni" : "active")}>
                      <SubmitButton className="badge hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer" pendingText="…">{m.status}</SubmitButton>
                    </form>
                  </td>
                  <td className="td text-right">
                    <form action={removeMemberAction.bind(null, slug, m.id)}>
                      <ConfirmButton message={`Remove ${m.full_name} from the club?`} className="text-sm text-red-600 hover:underline">Remove</ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
