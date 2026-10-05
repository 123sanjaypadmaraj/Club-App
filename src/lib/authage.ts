/** Seconds since the newest sign-in method (password, TOTP…) in this session; Infinity when none are known. `timestamp` is epoch seconds. */
export function authAgeSeconds(methods: readonly unknown[] | null | undefined, nowMs: number): number {
  const newest = Math.max(0, ...(methods ?? []).map((m) => {
      const t = (m as { timestamp?: unknown })?.timestamp;
      return typeof t === "number" && Number.isFinite(t) ? t : 0;
    }));
  return newest > 0 ? Math.max(0, nowMs / 1000 - newest) : Infinity;
}
