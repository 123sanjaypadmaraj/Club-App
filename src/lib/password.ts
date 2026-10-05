export const MIN_PASSWORD_LENGTH = 12;

const COMMON = ["password", "123456", "qwerty", "letmein", "welcome", "admin", "iloveyou", "clubhub", "college", "student", "abc123"];

/** Returns a message when the password is too weak to accept, otherwise null. `identity` = username or email it must not contain. */
export function weakPasswordReason(password: string, identity = ""): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  const lower = password.toLowerCase();
  if (COMMON.some((w) => lower.includes(w))) return "Password is too easy to guess. Avoid common words like “password”.";
  if (/^(.)\1+$/.test(password) || /^(?:0123456789|abcdefghij)/i.test(password)) return "Password is too easy to guess.";
  const who = identity.split("@")[0].toLowerCase();
  if (who.length >= 4 && lower.includes(who)) return "Password must not contain your username or email.";
  if (new Set(password).size < 5) return "Password needs more variety of characters.";
  return null;
}

/** Returns an error message, or null when the password change request is acceptable. */
export function validatePasswordChange(current: string, next: string, confirm: string, identity = ""): string | null {
  if (!current) return "Enter your current password.";
  const weak = weakPasswordReason(next, identity);
  if (weak) return weak;
  if (next !== confirm) return "New passwords do not match.";
  if (next === current) return "New password must be different from the current one.";
  return null;
}
