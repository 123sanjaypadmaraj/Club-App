import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Empty, PageHeader } from "@/components/ui";
import { AUDIT_ACTIONS } from "@/lib/audit";
import { formatDetail, isUuid, parseBefore } from "@/lib/auditview";
import { pickFilter } from "@/lib/categories";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Audit log" };

const PAGE = 100;
type Row = { id: number; at: string; actor: string | null; action: string; target: string | null; detail: unknown };

export default async function AuditPage({ searchParams }: PageProps<"/dashboard/audit">) {
  await requireAdmin();
  const sp = await searchParams;
  const actions = Object.values(AUDIT_ACTIONS) as string[];
  const action = pickFilter(sp.action, actions);
  const before = parseBefore(sp.before);

  const supabase = await createClient();
  let q = supabase.from("audit_log").select("id, at, actor, action, target, detail").order("id", { ascending: false }).limit(PAGE);
  if (action) q = q.eq("action", action);
  if (before) q = q.lt("id", before);
  const { data } = await q;
  const rows = (data ?? []) as Row[];

  const ids = [...new Set(rows.flatMap((r) => [r.actor, r.target]).filter(isUuid))];
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, email").in("id", ids) : { data: [] };
  const who = new Map((people ?? []).map((p: { id: string; email: string | null }) => [p.id, p.email ?? p.id]));
  const name = (v: string | null) => (v ? (who.get(v) ?? v) : "—");

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams(extra);
    if (action) p.set("action", action);
    return `?${p.toString()}`;
  };

  return (
    <>
      <PageHeader title="Audit log" subtitle="Sensitive actions: sign-ins, exports, account and role changes, deletions." />
      <form method="get" className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="action" className="label !mb-0">Action</label>
        <select id="action" name="action" defaultValue={action} className="input !w-auto">
          <option value="">All</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button className="btn btn-primary">Filter</button>
      </form>
      {rows.length === 0 ? (
        <Empty>No entries.</Empty>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted"><tr><th className="p-3">When</th><th className="p-3">Who</th><th className="p-3">Action</th><th className="p-3">Target</th><th className="p-3">Detail</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="whitespace-nowrap p-3">{fmtDateTime(r.at)}</td>
                  <td className="p-3">{name(r.actor)}</td>
                  <td className="p-3 font-mono text-xs">{r.action}</td>
                  <td className="break-all p-3">{name(r.target)}</td>
                  <td className="break-all p-3 text-xs text-muted">{formatDetail(r.detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length === PAGE && <p className="mt-4 text-sm"><Link className="link" href={qs({ before: String(rows[rows.length - 1].id) })}>Older →</Link></p>}
    </>
  );
}
