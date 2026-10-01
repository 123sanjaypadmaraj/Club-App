const tz = "Asia/Kolkata";
export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: tz });
export const fmtDateTime = (d: string | Date) =>
  new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz });
export const fmtMoney = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
export const fmtNum = (n: number) => n.toLocaleString("en-IN");
export const pct = (n: number | null) => (n == null ? "—" : `${n}%`);
export const rating = (n: number | null) => (n == null ? "—" : n.toFixed(1));

/** Value for <input type="datetime-local"> (IST) from an ISO string. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).toLocaleString("en-US", { timeZone: tz }));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
/** Parse datetime-local (assumed IST, +05:30) back to ISO. */
export function fromLocalInput(v: string): string | null {
  return v ? new Date(v + ":00+05:30").toISOString() : null;
}

export const safeUrl = (v: FormDataEntryValue | null): string | null => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};
export const str = (v: FormDataEntryValue | null): string | null => {
  const s = String(v ?? "").trim();
  return s || null;
};
export const int = (v: FormDataEntryValue | null): number | null => {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : null;
};
