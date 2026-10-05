/** Longest valid email address (RFC 5321). Checked first so a huge input never reaches the regex. */
const MAX_EMAIL = 254;
// Local part and domain labels are bounded, which keeps the match linear-time on hostile input.
const EMAIL = /^[^\s@]{1,64}@[^\s@.]{1,255}(?:\.[^\s@.]{1,63})+$/;

export function isEmail(v: unknown): v is string {
  return typeof v === "string" && v.length <= MAX_EMAIL && EMAIL.test(v);
}

/** Largest CSV text we will parse in one import (characters or bytes). */
export const MAX_IMPORT_BYTES = 1_000_000;
