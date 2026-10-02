"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkParticipantsAction, setAttendanceAction, type BulkOp } from "@/app/dashboard/actions";
import { toCsv } from "@/lib/csv";
import { fmtDateTime } from "@/lib/format";
import { displayEmail, filterRegistrations, sortRegistrations, type SortKey } from "@/lib/participants";
import type { Registration } from "@/lib/types";

type Status = "all" | "in" | "out" | "waitlist";
const PAGE = 50;

export function ParticipantsTable({ slug, eventId, eventTitle, rows }: { slug: string; eventId: string; eventTitle: string; rows: Registration[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [dept, setDept] = useState("");
  const [year, setYear] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "registered", dir: "desc" });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const depts = useMemo(() => [...new Set(rows.map((r) => r.department?.trim()).filter(Boolean) as string[])].sort(), [rows]);
  const years = useMemo(() => [...new Set(rows.map((r) => r.year).filter(Boolean) as number[])].sort(), [rows]);
  const counts = useMemo(() => {
    const c = rows.filter((r) => r.status === "confirmed");
    return { all: c.length, in: c.filter((r) => r.attended).length, out: c.filter((r) => !r.attended).length, waitlist: rows.length - c.length };
  }, [rows]);

  const shown = useMemo(() => {
    let list = rows;
    if (status === "waitlist") list = list.filter((r) => r.status === "waitlisted");
    else {
      list = list.filter((r) => r.status === "confirmed");
      if (status === "in") list = list.filter((r) => r.attended);
      if (status === "out") list = list.filter((r) => !r.attended);
    }
    if (dept) list = list.filter((r) => (r.department?.trim() ?? "") === dept);
    if (year) list = list.filter((r) => String(r.year ?? "") === year);
    return sortRegistrations(filterRegistrations(list, query), sort.key, sort.dir);
  }, [rows, status, dept, year, query, sort]);

  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const pageRows = shown.slice(cur * PAGE, cur * PAGE + PAGE);
  const chosen = shown.filter((r) => selected.has(r.id));
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  const reset = (fn: () => void) => { fn(); setPage(0); setSelected(new Set()); };
  const sortBy = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));
  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : "");

  const bulk = (op: BulkOp, ids: string[], confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    startTransition(async () => {
      const res = await bulkParticipantsAction(slug, eventId, ids, op).catch(() => null);
      if (!res?.ok) return setMsg({ kind: "error", text: res?.error ?? "No connection." });
      setMsg({ kind: "ok", text: `${res.count} updated.` });
      setSelected(new Set());
      router.refresh();
    });
  };

  const toggleOne = (r: Registration) =>
    startTransition(async () => {
      const res = await setAttendanceAction(slug, eventId, r.id, !r.attended).catch(() => null);
      if (!res?.ok) setMsg({ kind: "error", text: res?.error ?? "No connection." });
      router.refresh();
    });

  const copyEmails = async () => {
    const emails = [...new Set((chosen.length ? chosen : shown).map((r) => displayEmail(r.email)).filter(Boolean))];
    try {
      await navigator.clipboard.writeText(emails.join("; "));
      setMsg({ kind: "ok", text: `Copied ${emails.length} email addresses.` });
    } catch {
      setMsg({ kind: "error", text: "Couldn't access the clipboard." });
    }
  };

  const downloadCsv = () => {
    const src = chosen.length ? chosen : shown;
    const body = toCsv(
      src.map((r) => ({
        Name: r.full_name, Email: displayEmail(r.email), "Roll no": r.roll_no, Department: r.department, Year: r.year, Phone: r.phone,
        Status: r.status, Ticket: r.ticket_code, Registered: r.registered_at, Attended: r.attended ? "yes" : "no", "Checked in at": r.attended_at,
      })),
      ["Name", "Email", "Roll no", "Department", "Year", "Phone", "Status", "Ticket", "Registered", "Attended", "Checked in at"],
    );
    const url = URL.createObjectURL(new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${eventTitle.replace(/[^\w-]+/g, "_")}-participants.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { id: Status; label: string; n: number }[] = [
    { id: "all", label: "Confirmed", n: counts.all },
    { id: "in", label: "Arrived", n: counts.in },
    { id: "out", label: "Not arrived", n: counts.out },
    ...(counts.waitlist ? [{ id: "waitlist" as Status, label: "Waitlist", n: counts.waitlist }] : []),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => reset(() => setQuery(e.target.value))}
          placeholder="Search name, email, roll no, phone, ticket"
          className="input max-w-xs"
          aria-label="Search participants"
        />
        <select value={dept} onChange={(e) => reset(() => setDept(e.target.value))} className="input !w-auto" aria-label="Filter by department">
          <option value="">All departments</option>
          {depts.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select value={year} onChange={(e) => reset(() => setYear(e.target.value))} className="input !w-auto" aria-label="Filter by year">
          <option value="">All years</option>
          {years.map((y) => <option key={y} value={y}>Year {y}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn" onClick={copyEmails}>Copy emails</button>
          <button type="button" className="btn" onClick={downloadCsv}>CSV ({chosen.length || shown.length})</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-0.5 text-sm" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={status === t.id}
            onClick={() => reset(() => setStatus(t.id))}
            className={`rounded-md px-3 py-1.5 ${status === t.id ? "bg-brand text-brand-fg" : "text-muted hover:text-foreground"}`}
          >
            {t.label} <span className="tabular-nums opacity-80">{t.n}</span>
          </button>
        ))}
      </div>

      {msg && (
        <div role={msg.kind === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${msg.kind === "error" ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"}`}>
          {msg.text}
        </div>
      )}

      {chosen.length > 0 && (
        <div className="card flex flex-wrap items-center gap-2 !py-2.5 text-sm">
          <strong>{chosen.length} selected</strong>
          {status !== "waitlist" && <button type="button" className="btn !py-1" disabled={pending} onClick={() => bulk("present", chosen.map((r) => r.id))}>Mark present</button>}
          {status !== "waitlist" && <button type="button" className="btn !py-1" disabled={pending} onClick={() => bulk("absent", chosen.map((r) => r.id))}>Mark not arrived</button>}
          {status === "waitlist" && <button type="button" className="btn btn-primary !py-1" disabled={pending} onClick={() => bulk("promote", chosen.map((r) => r.id))}>Promote to confirmed</button>}
          <button type="button" className="btn btn-danger !py-1" disabled={pending} onClick={() => bulk("remove", chosen.map((r) => r.id), `Remove ${chosen.length} participant(s) from this event?`)}>Remove</button>
          <button type="button" className="ml-auto text-xs text-muted underline" onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">No participants match these filters.</div>
      ) : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-line">
                <th className="th w-8">
                  <input
                    type="checkbox"
                    checked={allOnPage}
                    aria-label="Select all on this page"
                    onChange={() => setSelected((s) => { const n = new Set(s); pageRows.forEach((r) => (allOnPage ? n.delete(r.id) : n.add(r.id))); return n; })}
                  />
                </th>
                <SortTh label="Name" k="name" sortBy={sortBy} arrow={arrow} />
                <th className="th">Email</th><th className="th">Roll no</th>
                <SortTh label="Dept" k="dept" sortBy={sortBy} arrow={arrow} />
                <SortTh label="Yr" k="year" sortBy={sortBy} arrow={arrow} />
                <th className="th">Phone</th>
                <SortTh label="Registered" k="registered" sortBy={sortBy} arrow={arrow} />
                <SortTh label="Status" k="status" sortBy={sortBy} arrow={arrow} />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {pageRows.map((r) => (
                <tr key={r.id} className={selected.has(r.id) ? "bg-brand/5" : ""}>
                  <td className="td">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      aria-label={`Select ${r.full_name}`}
                      onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })}
                    />
                  </td>
                  <td className="td font-medium">{r.full_name}</td>
                  <td className="td text-muted">{displayEmail(r.email)}</td>
                  <td className="td">{r.roll_no}</td>
                  <td className="td">{r.department}</td>
                  <td className="td">{r.year}</td>
                  <td className="td">{r.phone}</td>
                  <td className="td text-muted">{fmtDateTime(r.registered_at)}</td>
                  <td className="td">
                    {r.status === "waitlisted" ? (
                      <button type="button" className="btn !py-1" disabled={pending} onClick={() => bulk("promote", [r.id])}>Promote</button>
                    ) : (
                      <button type="button" className={`btn !py-1 ${r.attended ? "btn-primary" : ""}`} disabled={pending} onClick={() => toggleOne(r)}>
                        {r.attended ? "✓ Present" : "Check in"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>Showing {shown.length ? cur * PAGE + 1 : 0}–{Math.min(shown.length, cur * PAGE + PAGE)} of {shown.length}</span>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <button type="button" className="btn !py-1" disabled={cur === 0} onClick={() => setPage(cur - 1)}>← Prev</button>
            <span>Page {cur + 1} / {pages}</span>
            <button type="button" className="btn !py-1" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SortTh({ label, k, sortBy, arrow }: { label: string; k: SortKey; sortBy: (k: SortKey) => void; arrow: (k: SortKey) => string }) {
  return (
    <th className="th" aria-sort={undefined}>
      <button type="button" className="uppercase tracking-wide hover:text-foreground" onClick={() => sortBy(k)}>{label}{arrow(k)}</button>
    </th>
  );
}
