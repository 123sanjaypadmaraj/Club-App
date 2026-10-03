import type { Member } from "@/lib/types";

/** Case-insensitive substring match on name, email, roll no, department or position, plus an optional status. */
export function filterMembers(members: Member[], q: string, status: string): Member[] {
  const needle = q.trim().toLowerCase();
  return members.filter((m) => {
    if (status && m.status !== status) return false;
    if (!needle) return true;
    return [m.full_name, m.email, m.roll_no, m.department, m.position].some((v) => (v ?? "").toLowerCase().includes(needle));
  });
}

type MemberKey = { email?: string | null; roll_no?: string | null };

const emailKey = (m: MemberKey) => m.email?.trim().toLowerCase() || null;
const rollKey = (m: MemberKey) => m.roll_no?.trim().toLowerCase() || null;

/**
 * Split rows into new people and duplicates. A row duplicates an existing member (or an earlier row)
 * when its email matches, or, when it has no email, its roll number matches. Rows with neither are kept.
 */
export function dedupeMembers<T extends MemberKey>(rows: T[], existing: MemberKey[]): { fresh: T[]; duplicates: number } {
  const emails = new Set<string>();
  const rolls = new Set<string>();
  for (const m of existing) {
    const e = emailKey(m);
    const r = rollKey(m);
    if (e) emails.add(e);
    if (r) rolls.add(r);
  }
  const fresh: T[] = [];
  let duplicates = 0;
  for (const row of rows) {
    const e = emailKey(row);
    const r = rollKey(row);
    const dup = e ? emails.has(e) : r ? rolls.has(r) : false;
    if (dup) { duplicates++; continue; }
    if (e) emails.add(e);
    if (r) rolls.add(r);
    fresh.push(row);
  }
  return { fresh, duplicates };
}
