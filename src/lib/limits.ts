/** Max lengths for public (anonymous) input. Keep in sync with the check constraints in supabase/event_ops.sql. */
export const LIMITS = {
  full_name: 120,
  email: 160,
  roll_no: 40,
  department: 80,
  phone: 20,
  comment: 2000,
} as const;

export type LimitedField = keyof typeof LIMITS;

const LABELS: Record<LimitedField, string> = {
  full_name: "Name",
  email: "Email",
  roll_no: "Roll number",
  department: "Department",
  phone: "Phone number",
  comment: "Comments",
};

/** Returns a friendly message for the first over-long field, or null when everything fits. */
export function validateLengths(values: Partial<Record<LimitedField, string | null | undefined>>): string | null {
  for (const key of Object.keys(LIMITS) as LimitedField[]) {
    const v = values[key];
    if (v && v.length > LIMITS[key]) return `${LABELS[key]} is too long (max ${LIMITS[key]} characters).`;
  }
  return null;
}
