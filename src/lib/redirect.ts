const BACKSLASH = String.fromCharCode(92);

/** `next` value for the login redirect: the path plus its query string (search includes the leading ?). */
export function loginRedirectTarget(pathname: string, search: string): string {
  return pathname + (search && search !== "?" ? search : "");
}

/**
 * Same-site relative path for post-login redirects; anything else falls back.
 * Browsers read a backslash as a slash and drop tabs/newlines inside URLs, so
 * "/<backslash>evil.com" or "/<tab>/evil.com" would otherwise leave the site.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.includes(BACKSLASH)) return fallback;
  for (let i = 0; i < next.length; i++) {
    const c = next.charCodeAt(i);
    if (c < 32 || c === 127) return fallback;
  }
  return next;
}
