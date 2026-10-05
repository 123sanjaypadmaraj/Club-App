import { isEmail } from "@/lib/email";
import type { Registration } from "@/lib/types";
import { validateLengths } from "@/lib/limits";

/** Case-insensitive substring match on name, email, roll no, phone or ticket code. An empty query returns everything. */
export function filterRegistrations(regs: Registration[], q: string): Registration[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return regs;
  return regs.filter((r) =>
    [r.full_name, r.email, r.roll_no, r.phone, r.ticket_code].some((v) => (v ?? "").toLowerCase().includes(needle)),
  );
}

/** Walk-ins without an email get a placeholder so the unique-email rule still holds. */
export const PLACEHOLDER_DOMAIN = "no-email.invalid";
export const isPlaceholderEmail = (email: string) => email.toLowerCase().endsWith("@" + PLACEHOLDER_DOMAIN);
export const displayEmail = (email: string) => (isPlaceholderEmail(email) ? "" : email);
export const placeholderEmail = (seed: string) => `walkin-${seed.toLowerCase()}@${PLACEHOLDER_DOMAIN}`;

export type SortKey = "name" | "registered" | "dept" | "year" | "status";

export function sortRegistrations(regs: Registration[], key: SortKey, dir: "asc" | "desc" = "asc"): Registration[] {
  const m = dir === "asc" ? 1 : -1;
  const text = (v: string | null) => (v ?? "").toLowerCase();
  const byName = (a: Registration, b: Registration) => text(a.full_name).localeCompare(text(b.full_name));
  const cmp = (a: Registration, b: Registration): number => {
    switch (key) {
      case "name": return byName(a, b);
      case "dept": return text(a.department).localeCompare(text(b.department)) || byName(a, b);
      case "year": return (a.year ?? 99) - (b.year ?? 99) || byName(a, b);
      case "status": return Number(a.attended) - Number(b.attended) || byName(a, b);
      default: return a.registered_at.localeCompare(b.registered_at);
    }
  };
  return [...regs].sort((a, b) => m * cmp(a, b));
}

export type ImportRow = {
  full_name: string; email: string; roll_no: string | null; department: string | null; year: number | null; phone: string | null;
};
type Col = keyof ImportRow;

const HEADER_ALIASES: Record<Col, RegExp> = {
  full_name: /^(full\s*name|name|student\s*name|participant)$/i,
  email: /^(e-?mail|email\s*(id|address)?|college\s*email)$/i,
  roll_no: /^(roll(\s*(no|number))?|reg(istration)?\s*(no|number)?|usn|enrol?ment.*)$/i,
  department: /^(dept|department|branch|stream)$/i,
  year: /^(year|yr|year\s*of\s*study)$/i,
  phone: /^(phone|mobile|contact|phone\s*number|mobile\s*number|whatsapp.*)$/i,
};
const POSITIONAL: Col[] = ["full_name", "email", "roll_no", "department", "year", "phone"];

/**
 * Turn parsed CSV rows (e.g. a Google Forms export) into registrations.
 * If the first row looks like a header, columns are matched by name; otherwise by position
 * (name, email, roll no, department, year, phone). Duplicate emails inside the file are dropped.
 */
export function parseParticipantRows(rows: string[][]): { valid: ImportRow[]; invalid: number; duplicates: number } {
  if (rows.length === 0) return { valid: [], invalid: 0, duplicates: 0 };
  const mapped = rows[0].map((h) => (Object.keys(HEADER_ALIASES) as Col[]).find((k) => HEADER_ALIASES[k].test(h.trim())) ?? null);
  const hasHeader = mapped.includes("email") || (mapped.includes("full_name") && mapped.filter(Boolean).length >= 2);
  const cols: (Col | null)[] = hasHeader ? mapped : POSITIONAL;
  const body = hasHeader ? rows.slice(1) : rows;

  const seen = new Set<string>();
  const valid: ImportRow[] = [];
  let invalid = 0;
  let duplicates = 0;
  for (const row of body) {
    const rec: Partial<Record<Col, string>> = {};
    cols.forEach((k, i) => { if (k && row[i] !== undefined) rec[k] = row[i].trim(); });
    const email = (rec.email ?? "").toLowerCase();
    if (!rec.full_name || !isEmail(email)) { invalid++; continue; }
    if (validateLengths({ full_name: rec.full_name, email, roll_no: rec.roll_no, department: rec.department, phone: rec.phone })) { invalid++; continue; }
    if (seen.has(email)) { duplicates++; continue; }
    seen.add(email);
    const year = parseInt(rec.year ?? "", 10);
    valid.push({
      full_name: rec.full_name, email, roll_no: rec.roll_no || null, department: rec.department || null,
      year: Number.isFinite(year) ? year : null, phone: rec.phone || null,
    });
  }
  return { valid, invalid, duplicates };
}
