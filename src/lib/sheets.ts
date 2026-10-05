import { parseCsv } from "@/lib/csv";

/**
 * Turn a Google Sheets link into a CSV download URL, or null if it isn't one we trust.
 * Accepts the normal edit link (needs "Anyone with the link can view") or a "Publish to web" CSV link.
 */
export function sheetCsvUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:" || u.hostname !== "docs.google.com") return null;
  const m = u.pathname.match(/^\/spreadsheets\/d\/(e\/)?([\w-]+)/);
  if (!m) return null;
  if (m[1]) return `https://docs.google.com/spreadsheets/d/e/${m[2]}/pub?output=csv${gid(u)}`;
  return `https://docs.google.com/spreadsheets/d/${m[2]}/export?format=csv${gid(u)}`;
}

function gid(u: URL): string {
  const g = u.searchParams.get("gid") ?? u.hash.match(/gid=(\d+)/)?.[1];
  return g && /^\d+$/.test(g) ? `&gid=${g}` : "";
}

export type SheetResult = { ok: true; header: string[]; rows: string[][] } | { ok: false; error: string };

const MAX_ROWS = 2000;

/** Fetch the sheet live (no caching) and parse it. Never throws. */
export async function fetchSheet(url: string): Promise<SheetResult> {
  const csv = sheetCsvUrl(url);
  if (!csv) return { ok: false, error: "That doesn't look like a Google Sheets link." };
  try {
    const res = await fetch(csv, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.includes("csv")) {
      return { ok: false, error: "Couldn't read the sheet. In Google Sheets choose Share → “Anyone with the link” → Viewer, then try again." };
    }
    const all = parseCsv(await res.text());
    if (all.length === 0) return { ok: false, error: "The sheet is empty." };
    return { ok: true, header: all[0], rows: all.slice(1, MAX_ROWS + 1) };
  } catch {
    return { ok: false, error: "Couldn't reach Google Sheets. Try again in a moment." };
  }
}
