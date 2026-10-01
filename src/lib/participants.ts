import type { Registration } from "@/lib/types";

/** Case-insensitive substring match on name, email or roll number. An empty query returns everything. */
export function filterRegistrations(regs: Registration[], q: string): Registration[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return regs;
  return regs.filter((r) => [r.full_name, r.email, r.roll_no].some((v) => (v ?? "").toLowerCase().includes(needle)));
}
