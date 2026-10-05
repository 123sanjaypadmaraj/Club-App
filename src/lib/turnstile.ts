import { logSecurityEvent } from "@/lib/log";

export type SiteverifyResult = { success?: boolean; action?: string; hostname?: string };

/**
 * Cloudflare recommends checking more than `success`: the token must have been solved for this form (`action`) and on
 * this site (`hostname`). The hostname is only enforced when NEXT_PUBLIC_SITE_URL is set, so preview deploys keep working.
 * Returns null when the result is acceptable, otherwise why it was refused.
 */
export function checkSiteverify(json: SiteverifyResult, expect: { action: string; siteUrl?: string }): "failed" | "action" | "hostname" | null {
  if (json.success !== true) return "failed";
  if (json.action !== expect.action) return "action";
  if (expect.siteUrl) {
    let host: string | null = null;
    try { host = new URL(expect.siteUrl).hostname; } catch { host = null; }
    if (host && json.hostname !== host) return "hostname";
  }
  return null;
}

export const turnstileEnabled = () => Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

/**
 * Check a Cloudflare Turnstile token. When the keys are not configured the check is skipped (dev / not yet set up).
 * When they are configured, a missing token, a rejected token or an unreachable verifier all count as a failure.
 */
export async function verifyTurnstile(token: FormDataEntryValue | null, ip: string, action: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return true;
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const json = (await res.json()) as SiteverifyResult;
    const problem = checkSiteverify(json, { action, siteUrl: process.env.NEXT_PUBLIC_SITE_URL });
    if (problem === "failed") logSecurityEvent("captcha_failed");
    else if (problem) logSecurityEvent("captcha_mismatch", { reason: problem });
    return problem === null;
  } catch {
    logSecurityEvent("captcha_unavailable");
    return false;
  }
}
