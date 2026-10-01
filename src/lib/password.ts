/** Returns an error message, or null when the password change request is acceptable. */
export function validatePasswordChange(current: string, next: string, confirm: string): string | null {
  if (!current) return "Enter your current password.";
  if (next.length < 8) return "New password must be at least 8 characters.";
  if (next !== confirm) return "New passwords do not match.";
  if (next === current) return "New password must be different from the current one.";
  return null;
}
