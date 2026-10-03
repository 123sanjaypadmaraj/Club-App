/** Max lengths for public (anonymous) input. Keep in sync with the check constraints in supabase/event_ops.sql. */
export const LIMITS = {
  full_name: 120,
  email: 160,
  roll_no: 40,
  department: 80,
  phone: 20,
  comment: 2000,
  title: 160,
  body: 2000,
  club_name: 80,
  tagline: 140,
  about: 2000,
  venue: 160,
  event_description: 4000,
  faculty_advisor: 120,
  meeting_schedule: 160,
} as const;

export type LimitedField = keyof typeof LIMITS;

const LABELS: Record<LimitedField, string> = {
  full_name: "Name",
  email: "Email",
  roll_no: "Roll number",
  department: "Department",
  phone: "Phone number",
  comment: "Comments",
  title: "Title",
  body: "Message",
  club_name: "Club name",
  tagline: "Tagline",
  about: "About",
  venue: "Venue",
  event_description: "Description",
  faculty_advisor: "Faculty advisor",
  meeting_schedule: "Meeting schedule",
};

/** Returns a friendly message for the first over-long field, or null when everything fits. */
export function validateLengths(values: Partial<Record<LimitedField, string | null | undefined>>): string | null {
  for (const key of Object.keys(LIMITS) as LimitedField[]) {
    const v = values[key];
    if (v && v.length > LIMITS[key]) return `${LABELS[key]} is too long (max ${LIMITS[key]} characters).`;
  }
  return null;
}
