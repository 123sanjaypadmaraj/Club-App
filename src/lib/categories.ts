export const EVENT_CATEGORIES = ["Workshop", "Competition", "Talk", "Social", "Meeting", "Performance", "Volunteering", "Other"];

/** Returns `value` only if it is one of `allowed`; unknown or missing values become "" (no filter). */
export function pickFilter(value: string | string[] | undefined, allowed: string[]): string {
  const v = Array.isArray(value) ? value[0] : value;
  return v && allowed.includes(v) ? v : "";
}
