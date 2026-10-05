export const LAST_SEEN_COOKIE = "ch_last_seen";

export type SessionState = "ok" | "idle" | "absolute";

/** Whether a signed-in session is still allowed. Times are epoch ms; a missing/invalid `lastSeen` counts as "now". */
export function sessionExpiry(a: { now: number; signedInAt: number | null; lastSeen: number | null; idleMs: number; absoluteMs: number }): SessionState {
  if (a.signedInAt !== null && Number.isFinite(a.signedInAt) && a.now - a.signedInAt > a.absoluteMs) return "absolute";
  if (a.lastSeen !== null && Number.isFinite(a.lastSeen) && a.now - a.lastSeen > a.idleMs) return "idle";
  return "ok";
}

export function parseLastSeen(v: string | undefined): number | null {
  if (!v || !/^\d{10,14}$/.test(v)) return null;
  return Number(v);
}

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export function sessionLimits(env: Record<string, string | undefined> = process.env) {
  return { idleMs: num(env.SESSION_IDLE_MINUTES, 60) * 60_000, absoluteMs: num(env.SESSION_MAX_HOURS, 12) * 3_600_000 };
}

export const lastSeenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
});

/**
 * Accounts whose password was set by the admin must choose their own before using the dashboard. The flag lives in
 * app_metadata, which users cannot edit. Only page loads are redirected; /dashboard/account stays reachable.
 */
export function mustChangePassword(user: { app_metadata?: Record<string, unknown> } | null | undefined, pathname: string, method = "GET"): boolean {
  if (user?.app_metadata?.must_change_password !== true) return false;
  if (method !== "GET" && method !== "HEAD") return false;
  if (!pathname.startsWith("/dashboard")) return false;
  return !(pathname === "/dashboard/account" || pathname.startsWith("/dashboard/account/"));
}
