import { readFlash } from "@/lib/flash";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/SubmitButton";
import { Field, Notice, PageHeader } from "@/components/ui";
import { createClubAction } from "@/app/dashboard/actions";
import type { Club } from "@/lib/types";

export const metadata = { title: "Manage clubs" };

export default async function ClubsAdmin({ searchParams }: PageProps<"/dashboard/clubs">) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("clubs").select("*").order("name");
  const clubs = (data as Club[]) ?? [];

  return (
    <>
      <PageHeader title="Clubs" subtitle={`${clubs.length} clubs registered`} />
      <Notice {...readFlash(sp)} />

      <form action={createClubAction} className="card mb-6 grid items-end gap-4 sm:grid-cols-[1fr_12rem_auto]">
        <Field label="New club name"><input name="name" required maxLength={80} className="input" placeholder="e.g. Astronomy Club" /></Field>
        <Field label="Category"><input name="category" list="cats" defaultValue="Technical" className="input" /></Field>
        <datalist id="cats">{["Technical", "Cultural", "Arts", "Sports", "Social", "Business"].map((c) => <option key={c} value={c} />)}</datalist>
        <SubmitButton pendingText="Adding…">Add club</SubmitButton>
      </form>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full min-w-[560px]">
          <thead><tr className="border-b border-line"><th className="th">Club</th><th className="th">Category</th><th className="th">Status</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-line">
            {clubs.map((c) => (
              <tr key={c.id}>
                <td className="td font-medium"><Link href={`/dashboard/clubs/${c.slug}`} className="hover:text-brand hover:underline">{c.name}</Link></td>
                <td className="td text-muted">{c.category}</td>
                <td className="td">{c.is_active ? <span className="badge">Active</span> : <span className="badge text-muted">Inactive</span>}</td>
                <td className="td text-right"><Link href={`/dashboard/clubs/${c.slug}/settings`} className="text-sm text-brand hover:underline">Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
