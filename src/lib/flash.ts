import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Flash messages ("Saved", "Wrong password"…) travel in the URL as ?ok= / ?error=. Anyone can write a link that puts their
 * own words on the real site, so each message carries a signature (`fs`) that only this server can produce, and unsigned
 * or altered messages are dropped. The key is FLASH_SECRET, or derived from the service-role key. With neither set
 * (local development) nothing is signed and every message is accepted.
 */
export type FlashKind = "ok" | "error";
export type FlashSearchParams = Record<string, string | string[] | undefined>;

const SIG_LENGTH = 22;

function key(): Buffer | null {
  const secret = process.env.FLASH_SECRET?.trim();
  if (secret) return Buffer.from(secret);
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return service ? createHmac("sha256", service).update("club-hub-flash").digest() : null;
}

function sign(k: Buffer, kind: FlashKind, msg: string): string {
  return createHmac("sha256", k).update(`${kind}\n${msg}`).digest("base64url").slice(0, SIG_LENGTH);
}

/** Query-string text for one flash message, e.g. `error=Wrong%20password&fs=abc…`. */
export function flashQuery(kind: FlashKind, msg: string): string {
  const k = key();
  const base = `${kind}=${encodeURIComponent(msg)}`;
  return k ? `${base}&fs=${sign(k, kind, msg)}` : base;
}

/** Put a signed flash message on a URL object. */
export function applyFlash(url: URL, kind: FlashKind, msg: string): void {
  url.searchParams.set(kind, msg);
  const k = key();
  if (k) url.searchParams.set("fs", sign(k, kind, msg));
}

const first = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** The messages in a page's search params that carry a valid signature. */
export function readFlash(sp: FlashSearchParams): { ok?: string; error?: string } {
  const k = key();
  const out: { ok?: string; error?: string } = {};
  const fs = first(sp.fs);
  for (const kind of ["ok", "error"] as const) {
    const msg = first(sp[kind]);
    if (!msg || msg.length > 500) continue;
    if (!k) { out[kind] = msg; continue; }
    if (!fs || fs.length !== SIG_LENGTH) continue;
    const expected = Buffer.from(sign(k, kind, msg));
    const given = Buffer.from(fs);
    if (given.length === expected.length && timingSafeEqual(given, expected)) out[kind] = msg;
  }
  return out;
}
