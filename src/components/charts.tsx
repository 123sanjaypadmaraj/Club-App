import type { MonthPoint } from "@/lib/stats";

/** Registrations (bars) with attendance (line) per month. Pure SVG, scales to container width. */
export function TrendChart({ points }: { points: MonthPoint[] }) {
  if (points.length === 0) return <div className="py-10 text-center text-sm text-muted">No data in this period.</div>;
  const W = 720, H = 240, pl = 36, pr = 8, pt = 12, pb = 28;
  const max = Math.max(1, ...points.map((p) => p.registrations));
  const niceMax = Math.ceil(max / 10) * 10 || 10;
  const iw = W - pl - pr, ih = H - pt - pb;
  const step = iw / points.length;
  const bw = Math.min(40, step * 0.6);
  const y = (v: number) => pt + ih - (v / niceMax) * ih;
  const x = (i: number) => pl + step * i + step / 2;
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.attendees).toFixed(1)}`).join(" ");
  const ticks = [0, 0.5, 1].map((t) => Math.round(niceMax * t));
  const every = Math.ceil(points.length / 12);

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Registrations and attendance by month">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="var(--border)" />
            <text x={pl - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{t}</text>
          </g>
        ))}
        {points.map((p, i) => (
          <g key={p.key}>
            <rect x={x(i) - bw / 2} y={y(p.registrations)} width={bw} height={Math.max(0, pt + ih - y(p.registrations))} rx="3" fill="var(--brand)" opacity="0.85">
              <title>{`${p.label}: ${p.registrations} registrations, ${p.attendees} attended, ${p.events} events`}</title>
            </rect>
            {i % every === 0 && <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">{p.label}</text>}
          </g>
        ))}
        <path d={line} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((p, i) => <circle key={p.key} cx={x(i)} cy={y(p.attendees)} r="3" fill="#f59e0b" />)}
      </svg>
      <figcaption className="mt-2 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-sm bg-brand" /> Registrations</span>
        <span className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-full bg-amber-500" /> Attended</span>
      </figcaption>
    </figure>
  );
}

/** Horizontal bars — good for ranking clubs / categories. */
export function HBars({ rows, format = (n: number) => String(n) }: { rows: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate" title={r.label}>{r.label}</span>
          <div className="h-2.5 rounded-full bg-black/5 dark:bg-white/10">
            <div className="h-full rounded-full bg-brand" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="w-12 text-right tabular-nums text-muted">{format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export function Stars({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted">—</span>;
  return (
    <span className="whitespace-nowrap tabular-nums" title={`${value} out of 5`}>
      <span className="text-amber-500">★</span> {value.toFixed(1)}
    </span>
  );
}

/** Compact column chart for a short time series (arrivals per 15 min, registrations per day). */
export function MiniBars({ rows, label }: { rows: { label: string; value: number }[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure aria-label={label}>
      <div className="flex h-28 items-end gap-1" role="img" aria-label={`${label}: ${rows.map((r) => `${r.label} ${r.value}`).join(", ")}`}>
        {rows.map((r) => (
          <div key={r.label} className="flex h-full min-w-1 flex-1 flex-col justify-end" title={`${r.label}: ${r.value}`}>
            <div className="rounded-t bg-brand" style={{ height: `${Math.max(r.value ? 4 : 0, (r.value / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <figcaption className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{rows[0]?.label}</span><span>peak {max}</span><span>{rows[rows.length - 1]?.label}</span>
      </figcaption>
    </figure>
  );
}
