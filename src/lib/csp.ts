const TURNSTILE = "https://challenges.cloudflare.com";

/**
 * Content-Security-Policy string. With a `nonce`, scripts must carry it (inline scripts without it are blocked, `'strict-dynamic'`
 * lets trusted scripts load others such as Turnstile). Without one, falls back to `'unsafe-inline'` for the cacheable public pages.
 * `style-src` keeps `'unsafe-inline'` because inline `style={}` attributes cannot carry a nonce.
 */
export function buildCsp({ nonce, isDev }: { nonce?: string; isDev: boolean }): string {
  const script = nonce
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""} ${TURNSTILE}`
    : `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${TURNSTILE}`;
  return [
    "default-src 'self'",
    script,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:", // club logos may be hosted anywhere; QR/avatars are data: URIs
    "font-src 'self' data:",
    `connect-src 'self' ${TURNSTILE}${isDev ? " ws: wss:" : ""}`,
    `frame-src ${TURNSTILE}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
