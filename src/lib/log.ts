export type LogExtra = Record<string, string | number | null>;

/** One-line JSON for a failed server action. Callers pass ids only, never names, emails, phones or passwords. */
export function formatActionError(
  action: string,
  error: { code?: string; message?: string } | null | undefined,
  extra: LogExtra = {},
): string {
  return JSON.stringify({
    level: "error",
    action,
    code: error?.code ?? null,
    message: error?.message ?? null,
    ...extra,
  });
}

/** One-line JSON for security-relevant events (failed logins, throttling, CAPTCHA). Never pass emails, names or passwords. */
export function logSecurityEvent(event: string, extra: LogExtra = {}): void {
  console.warn(JSON.stringify({ level: "security", event, ...extra }));
}

export function logActionError(
  action: string,
  error: { code?: string; message?: string } | null | undefined,
  extra?: LogExtra,
): void {
  console.error(formatActionError(action, error, extra));
}
