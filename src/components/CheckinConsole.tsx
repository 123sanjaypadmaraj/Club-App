"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { checkInByCodeAction, loadRegistrationsAction, setAttendanceAction, walkInAction } from "@/app/dashboard/actions";
import { QrScanner } from "@/components/QrScanner";
import { fmtTime } from "@/lib/format";
import { displayEmail, filterRegistrations, sortRegistrations } from "@/lib/participants";
import { parseTicketCode } from "@/lib/tickets";
import type { Registration } from "@/lib/types";

type Filter = "waiting" | "in" | "all";
type Flash = { kind: "ok" | "warn" | "error"; text: string } | null;

const SHOW_MAX = 100;
const POLL_MS = 8000;

export function CheckinConsole({ slug, eventId, initial, capacity }: { slug: string; eventId: string; initial: Registration[]; capacity: number | null }) {
  const [rows, setRows] = useState<Registration[]>(initial);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("waiting");
  const [scanning, setScanning] = useState(false);
  const [walkIn, setWalkIn] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [busy, startTransition] = useTransition();
  const search = useRef<HTMLInputElement>(null);
  // Rows with an in-flight change: a poll must not overwrite them with stale server data.
  const pending = useRef(new Set<string>());
  const lastScan = useRef({ code: "", at: 0 });

  const confirmed = useMemo(() => rows.filter((r) => r.status === "confirmed"), [rows]);
  const waitlisted = rows.length - confirmed.length;
  const arrived = confirmed.filter((r) => r.attended).length;
  const pctIn = confirmed.length ? Math.round((arrived / confirmed.length) * 100) : 0;

  const say = useCallback((kind: "ok" | "warn" | "error", text: string) => setFlash({ kind, text }), []);

  // Keep several volunteers' screens in sync.
  useEffect(() => {
    let alive = true;
    const sync = async () => {
      if (document.hidden) return;
      const res = await loadRegistrationsAction(slug, eventId).catch(() => null);
      if (!alive || !res?.ok) return;
      setRows((cur) => {
        const local = new Map(cur.map((r) => [r.id, r]));
        return res.rows.map((r) => (pending.current.has(r.id) ? (local.get(r.id) ?? r) : r));
      });
      setSyncedAt(new Date());
    };
    const t = setInterval(sync, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [slug, eventId]);

  useEffect(() => {
    if (!flash || flash.kind === "error") return;
    const t = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(t);
  }, [flash]);

  const patch = useCallback((id: string, change: Partial<Registration>) => {
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, ...change } : r)));
  }, []);

  const toggle = useCallback(
    async (r: Registration, attended: boolean) => {
      const before = { attended: r.attended, attended_at: r.attended_at };
      pending.current.add(r.id);
      patch(r.id, { attended, attended_at: attended ? new Date().toISOString() : null });
      const res = await setAttendanceAction(slug, eventId, r.id, attended).catch(() => null);
      pending.current.delete(r.id);
      if (!res?.ok) {
        patch(r.id, before);
        say("error", res?.error ?? "No connection — that check-in was not saved.");
        return;
      }
      patch(r.id, { attended: res.attended, attended_at: res.attended_at });
      if (attended) {
        say("ok", `✓ ${r.full_name} checked in`);
        setQuery("");
        search.current?.focus();
      } else say("warn", `${r.full_name} marked as not arrived`);
    },
    [slug, eventId, patch, say],
  );

  const checkInCode = useCallback(
    async (input: string) => {
      const res = await checkInByCodeAction(slug, eventId, input).catch(() => null);
      if (!res) return say("error", "No connection — scan again in a moment.");
      if (!res.ok) return say("error", res.error);
      if (res.result === "checked_in") patch(res.id, { attended: true, attended_at: res.at });
      if (res.result === "checked_in") say("ok", `✓ ${res.name} checked in`);
      else if (res.result === "already") say("warn", `${res.name} was already checked in${res.at ? ` at ${fmtTime(res.at)}` : ""}`);
      else say("warn", `${res.name} is on the waitlist — not confirmed yet`);
    },
    [slug, eventId, patch, say],
  );

  const onScan = useCallback(
    (text: string) => {
      const code = parseTicketCode(text);
      if (!code) return;
      const now = Date.now();
      if (lastScan.current.code === code && now - lastScan.current.at < 4000) return; // same QR still in view
      lastScan.current = { code, at: now };
      navigator.vibrate?.(60);
      void checkInCode(code);
    },
    [checkInCode],
  );

  const matches = useMemo(() => {
    const base = query.trim() ? filterRegistrations(confirmed, query) : confirmed;
    const byFilter = filter === "all" || query.trim() ? base : base.filter((r) => (filter === "in" ? r.attended : !r.attended));
    return sortRegistrations(byFilter, filter === "in" && !query.trim() ? "registered" : "name", filter === "in" && !query.trim() ? "desc" : "asc");
  }, [confirmed, query, filter]);

  const onEnter = () => {
    if (matches.length === 1 && !matches[0].attended) void toggle(matches[0], true);
    else if (matches.length === 1) {
      const m = matches[0];
      say("warn", `${m.full_name} was already checked in${m.attended_at ? ` at ${fmtTime(m.attended_at)}` : ""}`);
    } else if (matches.length === 0 && parseTicketCode(query)) {
      void checkInCode(query);
      setQuery("");
    }
  };

  const tabs: { id: Filter; label: string; n: number }[] = [
    { id: "waiting", label: "Not arrived", n: confirmed.length - arrived },
    { id: "in", label: "Arrived", n: arrived },
    { id: "all", label: "Everyone", n: confirmed.length },
  ];

  return (
    <div className="space-y-4">
      <div className="card sticky top-2 z-10 space-y-2 shadow-md">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-4xl font-bold tabular-nums leading-none">
              {arrived}
              <span className="text-xl font-medium text-muted"> / {confirmed.length}</span>
            </div>
            <div className="mt-1 text-xs text-muted">
              checked in · {pctIn}%{capacity ? ` · capacity ${capacity}` : ""}
              {waitlisted > 0 ? ` · ${waitlisted} waitlisted` : ""}
            </div>
          </div>
          <div className="text-right text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${syncedAt ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden />
              {syncedAt ? `Live · synced ${fmtTime(syncedAt)}` : "Live sync on"}
            </span>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10" role="progressbar" aria-valuenow={pctIn} aria-valuemin={0} aria-valuemax={100} aria-label="Check-in progress">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pctIn}%` }} />
        </div>
      </div>

      {flash && (
        <div
          role={flash.kind === "error" ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-base font-medium ${
            flash.kind === "ok"
              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
              : flash.kind === "warn"
                ? "border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-200"
                : "border-red-500/50 bg-red-500/15 text-red-800 dark:text-red-200"
          }`}
        >
          {flash.text}
        </div>
      )}

      <div className="flex gap-2">
        <input
          ref={search}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onEnter())}
          placeholder="Search name, roll no, phone, email or ticket code…"
          className="input !py-3 !text-base"
          aria-label="Search participants"
          autoComplete="off"
          inputMode="search"
        />
        <button type="button" className={`btn !px-4 ${scanning ? "btn-primary" : ""}`} onClick={() => setScanning((s) => !s)} aria-pressed={scanning}>
          {scanning ? "Stop" : "Scan QR"}
        </button>
        <button type="button" className="btn !px-4" onClick={() => setWalkIn((w) => !w)} aria-expanded={walkIn}>
          + Walk-in
        </button>
      </div>

      {scanning && <QrScanner onCode={onScan} onClose={() => setScanning(false)} />}
      {walkIn && (
        <WalkInForm
          busy={busy}
          onSubmit={(v) =>
            startTransition(async () => {
              const res = await walkInAction(slug, eventId, v).catch(() => null);
              if (!res?.ok) return say("error", res?.error ?? "No connection — walk-in not saved.");
              setRows((cur) => [...cur, res.row]);
              say("ok", `✓ ${res.row.full_name} added and checked in`);
              setWalkIn(false);
              setQuery("");
              search.current?.focus();
            })
          }
          onCancel={() => setWalkIn(false)}
        />
      )}

      <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-0.5 text-sm" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={filter === t.id}
            onClick={() => setFilter(t.id)}
            className={`flex-1 rounded-md px-3 py-1.5 ${filter === t.id ? "bg-brand text-brand-fg" : "text-muted hover:text-foreground"}`}
          >
            {t.label} <span className="tabular-nums opacity-80">{t.n}</span>
          </button>
        ))}
      </div>

      {matches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
          {query.trim()
            ? "No one matches. Check the spelling, try the roll number — or add them as a walk-in."
            : filter === "waiting"
              ? confirmed.length === 0 ? "No confirmed registrations yet." : "🎉 Everyone has arrived."
              : "Nobody here yet."}
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {matches.slice(0, SHOW_MAX).map((r) => (
            <li key={r.id} className={`flex items-center gap-3 px-4 py-3 ${r.attended ? "bg-emerald-500/5" : ""}`}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold">{r.full_name}</div>
                <div className="truncate text-xs text-muted">
                  {[r.roll_no, r.department && `${r.department}${r.year ? ` Y${r.year}` : ""}`, displayEmail(r.email) || r.phone].filter(Boolean).join(" · ") || r.ticket_code}
                </div>
              </div>
              {r.attended ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">✓ {r.attended_at ? fmtTime(r.attended_at) : "In"}</span>
                  <button type="button" className="text-xs text-muted underline hover:text-foreground" onClick={() => void toggle(r, false)}>Undo</button>
                </div>
              ) : (
                <button type="button" className="btn btn-primary !px-5 !py-2.5 !text-base" onClick={() => void toggle(r, true)}>Check in</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {matches.length > SHOW_MAX && <p className="text-center text-xs text-muted">Showing the first {SHOW_MAX} of {matches.length} — type to narrow it down.</p>}
    </div>
  );
}

function WalkInForm({ onSubmit, onCancel, busy }: { onSubmit: (v: { full_name: string; email: string; phone: string; department: string; year: string }) => void; onCancel: () => void; busy: boolean }) {
  return (
    <form
      className="card grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const g = (k: string) => String(f.get(k) ?? "");
        onSubmit({ full_name: g("full_name"), email: g("email"), phone: g("phone"), department: g("department"), year: g("year") });
      }}
    >
      <label className="block sm:col-span-2"><span className="label">Name *</span><input name="full_name" required autoFocus className="input" autoComplete="off" /></label>
      <label className="block"><span className="label">Phone</span><input name="phone" type="tel" className="input" autoComplete="off" /></label>
      <label className="block"><span className="label">Email (optional)</span><input name="email" type="email" className="input" autoComplete="off" /></label>
      <label className="block"><span className="label">Department</span><input name="department" className="input" autoComplete="off" /></label>
      <label className="block"><span className="label">Year</span><input name="year" type="number" min={1} max={6} className="input" /></label>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={busy} className="btn btn-primary">{busy ? "Adding…" : "Add & check in"}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
