/**
 * Flags for the Supabase session cookies. The app has no browser Supabase client, so scripts never need to read them;
 * httpOnly keeps the refresh token away from any script that might run on a page. Cookie names stay as they are,
 * so existing sessions survive the change.
 */
export function sessionCookieOptions(isProd: boolean) {
  return { httpOnly: true, secure: isProd, sameSite: "lax" as const, path: "/" };
}

export const SESSION_COOKIE_OPTIONS = sessionCookieOptions(process.env.NODE_ENV === "production");
