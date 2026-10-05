import { logSecurityEvent } from "@/lib/log";

export const turnstileEnabled = () => Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

/**
 * Check a Cloudflare Turnstile token. When the keys are not configured the check is skipped (dev / not yet set up).
 * When they are configured, a missing token, a rejected token or an unreachable verifier all count as a failure.
 */
export async function verifyTurnstile(token: FormDataEntryValue | null, ip: string): Promise<boolean> {
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
    const json = (await res.json()) as { success?: boolean };
    if (!json.success) logSecurityEvent("captcha_failed");
    return json.success === true;
  } catch {
    logSecurityEvent("captcha_unavailable");
    return false;
  }
}
