import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/lib/log";

/** Best guess at the caller's IP from proxy headers (Vercel sets x-forwarded-for / x-real-ip itself). */
export function ipFromHeaders(get: (name: string) => string | null): string {
  const forwarded = get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || get("x-real-ip")?.trim() || "";
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : "unknown";
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return ipFromHeaders((n) => h.get(n));
}

/** Identifiers are hashed so the rate_limits table never stores raw IPs, usernames or emails. */
export function limitKey(scope: string, id: string): string {
  return `${scope}:${createHash("sha256").update(id.toLowerCase()).digest("hex").slice(0, 32)}`;
}

/**
 * Count one attempt and say whether it is allowed. Backed by the rate_limit_hit() function in
 * supabase/security.sql (callable by the service role only). Fails open, and logs, if the database
 * is unreachable or the function has not been installed, so an outage never locks everyone out.
 */
export async function rateLimit(scope: string, id: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await createServiceClient().rpc("rate_limit_hit", {
      p_key: limitKey(scope, id),
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      logSecurityEvent("rate_limit_unavailable", { scope, code: error.code ?? null });
      return true;
    }
    if (data === false) logSecurityEvent("rate_limited", { scope });
    return data !== false;
  } catch {
    logSecurityEvent("rate_limit_unavailable", { scope });
    return true;
  }
}

export const LIMITS_POLICY = {
  login: { max: 10, window: 15 * 60 },
  loginUser: { max: 8, window: 15 * 60 },
  loginUserDay: { max: 30, window: 24 * 60 * 60 },
  register: { max: 10, window: 60 * 60 },
  feedback: { max: 10, window: 60 * 60 },
  ticket: { max: 60, window: 10 * 60 },
  password: { max: 6, window: 15 * 60 },
  mfa: { max: 10, window: 10 * 60 },
} as const;
