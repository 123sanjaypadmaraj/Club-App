import { randomBytes } from "node:crypto";

// No 0/O/1/I/L so codes survive being read aloud or typed from a screenshot.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** 10-char unguessable ticket code (~49 bits). Server-side only. */
export function newTicketCode(): string {
  const bytes = randomBytes(10);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/** Pull a ticket code out of whatever a scanner / keyboard produced (raw code or a /ticket/<code> URL). */
export function parseTicketCode(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const fromUrl = s.match(/\/ticket\/([A-Za-z0-9]{6,20})\b/);
  const code = (fromUrl ? fromUrl[1] : s).toUpperCase();
  return /^[A-Z0-9]{6,20}$/.test(code) ? code : null;
}
