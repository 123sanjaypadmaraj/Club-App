const MAX_MESSAGE = 300;

/** Mask email-like words and cap the length, so a database or auth error cannot carry personal data into the logs. */
export function redactMessage(message: string | null | undefined): string | null {
  if (message == null) return null;
  const masked = message
    .split(/(\s+)/)
    .map((w) => (w.includes("@") && /@[^\s@]+\.[^\s@]+/.test(w.slice(0, 320)) ? "[email]" : w))
    .join("");
  return masked.length > MAX_MESSAGE ? masked.slice(0, MAX_MESSAGE) : masked;
}

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
    message: redactMessage(error?.message),
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
