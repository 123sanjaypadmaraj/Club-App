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

export function logActionError(
  action: string,
  error: { code?: string; message?: string } | null | undefined,
  extra?: LogExtra,
): void {
  console.error(formatActionError(action, error, extra));
}
