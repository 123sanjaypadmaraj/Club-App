import Link from "next/link";
import type { ReactNode } from "react";

/** Club logo in a fixed white tile (logos vary in shape); falls back to the club's initials on its accent colour. */
export function ClubLogo({ club, size = 48 }: { club: { name: string; logo_url: string | null; accent_color: string }; size?: number }) {
  const box = { width: size, height: size };
  if (!club.logo_url) {
    const initials = club.name.split(/[\s&.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
    return (
      <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-lg font-bold text-white" style={{ ...box, background: club.accent_color, fontSize: size / 2.6 }}>
        {initials}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small static logos; no optimisation needed
    <img src={club.logo_url} alt={`${club.name} logo`} loading="lazy" className="shrink-0 rounded-lg bg-white object-contain p-0.5 ring-1 ring-black/10" style={box} />
  );
}

const TONES = ["#6366f1", "#d946ef", "#f97316", "#10b981", "#0ea5e9", "#f43f5e", "#eab308", "#8b5cf6"];

/** Stable colour for a string (category, stat label…), so the same thing is always the same colour. */
export function toneFor(key: string): string {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

/** Category-style pill, tinted by its text. */
export function TintBadge({ children, tone }: { children: string; tone?: string }) {
  return <span className="badge tone" style={{ "--tone": tone ?? toneFor(children) } as React.CSSProperties}>{children}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="gradient-text w-fit text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, delta }: { label: string; value: ReactNode; hint?: ReactNode; delta?: number | null }) {
  return (
    <div className="card relative overflow-hidden" style={{ "--tone": toneFor(label), borderLeft: "4px solid var(--tone)", background: "linear-gradient(135deg, color-mix(in srgb, var(--tone) 12%, var(--surface)), var(--surface) 70%)" } as React.CSSProperties}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums" style={{ color: "color-mix(in srgb, var(--tone) 80%, var(--foreground))" }}>{value}</div>
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
