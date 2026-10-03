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
