import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, delta }: { label: string; value: ReactNode; hint?: ReactNode; delta?: number | null }) {
  return (
    <div className="card">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted">
        {delta != null && (
          <span className={delta >= 0 ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-semibold text-red-600 dark:text-red-400"}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
          </span>
        )}
        {hint}
      </div>
    </div>
  );
}

export function Notice({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
        error ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
      }`}
    >
      {error ?? ok}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">{children}</div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="btn">
      {children} <span aria-hidden>↗</span>
    </a>
  );
}

export function RangeFilter({ base, current, options }: { base: string; current: string; options: { value: string; label: string }[] }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-sm">
      {options.map((o) => (
        <Link
          key={o.value}
          href={`${base}?range=${o.value}`}
          className={`rounded-md px-3 py-1.5 ${current === o.value ? "bg-brand text-brand-fg" : "text-muted hover:text-foreground"}`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
