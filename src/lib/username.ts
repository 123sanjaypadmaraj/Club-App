/** Club leads sign in with a short username. Supabase auth needs an email, so a username maps to a hidden internal one. */
export const USERNAME_DOMAIN = "clubhub.example.com";

/** "stem" → "stem@clubhub.example.com"; anything containing "@" is treated as a real email and left alone. */
export function loginEmail(input: string): string {
  const v = input.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${USERNAME_DOMAIN}`;
}
