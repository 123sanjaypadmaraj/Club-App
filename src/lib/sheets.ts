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
const MAX_BYTES = 2_000_000;
const MAX_HOPS = 3;

/** Google serves exports from docs.google.com and redirects to *.googleusercontent.com / *.google.com; anything else is refused. */
export function isGoogleHost(host: string): boolean {
  return host === "docs.google.com" || /^[a-z0-9-]+\.(googleusercontent|google)\.com$/.test(host);
}

/** Read a response body as text, giving up once it passes `max` bytes. Returns null when too large. */
export async function readCapped(res: Response, max: number): Promise<string | null> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return null;
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Fetch the sheet live (no caching) and parse it. Never throws. Follows redirects only to Google hosts, caps the body size. */
export async function fetchSheet(url: string): Promise<SheetResult> {
  const csv = sheetCsvUrl(url);
  if (!csv) return { ok: false, error: "That doesn't look like a Google Sheets link." };
  try {
    let target = csv;
    let res: Response | null = null;
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      res = await fetch(target, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(10_000) });
      if (res.status < 300 || res.status >= 400) break;
      const loc = res.headers.get("location");
      const next = loc ? new URL(loc, target) : null;
      if (!next || next.protocol !== "https:" || !isGoogleHost(next.hostname) || hop === MAX_HOPS) {
        return { ok: false, error: "Couldn't read the sheet. In Google Sheets choose Share → “Anyone with the link” → Viewer, then try again." };
      }
      target = next.toString();
    }
    const type = res?.headers.get("content-type") ?? "";
    if (!res || !res.ok || !type.includes("csv")) {
      return { ok: false, error: "Couldn't read the sheet. In Google Sheets choose Share → “Anyone with the link” → Viewer, then try again." };
    }
    const text = await readCapped(res, MAX_BYTES);
    if (text === null) return { ok: false, error: "That sheet is too large to import. Use fewer rows." };
    const all = parseCsv(text);
    if (all.length === 0) return { ok: false, error: "The sheet is empty." };
    return { ok: true, header: all[0], rows: all.slice(1, MAX_ROWS + 1) };
  } catch {
    return { ok: false, error: "Couldn't reach Google Sheets. Try again in a moment." };
  }
}
