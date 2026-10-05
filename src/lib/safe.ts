export const DEFAULT_ACCENT = "#4f46e5";

/** A 6-digit hex colour, or the fallback. Values from the database go into style attributes, so anything else is dropped. */
export function safeColor(v: unknown, fallback: string = DEFAULT_ACCENT): string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

/** An http(s) URL, or undefined. Blocks javascript:, data: and other schemes in links and image sources. */
export function safeHref(v: unknown): string | undefined {
  if (typeof v !== "string" || v.length > 2048) return undefined;
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}
