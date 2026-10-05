import { applyFlash } from "@/lib/flash";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { loginRedirectTarget } from "@/lib/redirect";
import { LAST_SEEN_COOKIE, lastSeenCookieOptions, mustChangePassword, parseLastSeen, sessionExpiry, sessionLimits } from "@/lib/session";
import { logSecurityEvent } from "@/lib/log";
import { buildCsp } from "@/lib/csp";
import { SESSION_COOKIE_OPTIONS } from "@/lib/supabase/cookies";

// Refreshes the Supabase session cookie and keeps logged-out users out of /dashboard.
export async function proxy(request: NextRequest) {
  // Per-request nonce: Next reads it from the request's CSP header and stamps it on its own scripts.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp({ nonce, isDev: process.env.NODE_ENV !== "production" });
  const next = () => {
    const headers = new Headers(request.headers); // rebuilt each time so cookies refreshed by Supabase are included
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return NextResponse.next({ request: { headers } });
  };
  const withCsp = <T extends NextResponse>(res: T): T => {
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };
  let response = next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = next();
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, { ...options, ...SESSION_COOKIE_OPTIONS }));
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  if (!data.user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", loginRedirectTarget(request.nextUrl.pathname, request.nextUrl.search));
    return withCsp(NextResponse.redirect(url));
  }

  // End idle and very old sessions (shared lab computers): the Supabase refresh token alone would keep them alive forever.
  if (data.user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const now = Date.now();
    const state = sessionExpiry({
      now,
      signedInAt: data.user.last_sign_in_at ? Date.parse(data.user.last_sign_in_at) : null,
      lastSeen: parseLastSeen(request.cookies.get(LAST_SEEN_COOKIE)?.value),
      ...sessionLimits(),
    });
    if (state !== "ok") {
      logSecurityEvent("session_expired", { reason: state });
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      applyFlash(url, "error", "Your session expired. Please sign in again.");
      url.searchParams.set("next", loginRedirectTarget(request.nextUrl.pathname, request.nextUrl.search));
      const redirect = NextResponse.redirect(url);
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      redirect.cookies.delete(LAST_SEEN_COOKIE);
      return withCsp(redirect);
    }
    response.cookies.set(LAST_SEEN_COOKIE, String(now), lastSeenCookieOptions());
  }

  // Accounts that enabled two-step login must finish it before touching the dashboard (stops a stolen password skipping it).
  if (data.user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const url = request.nextUrl.clone();
      url.pathname = "/login/mfa";
      url.search = "";
      url.searchParams.set("next", loginRedirectTarget(request.nextUrl.pathname, request.nextUrl.search));
      return withCsp(NextResponse.redirect(url));
    }
  }
  if (mustChangePassword(data.user, request.nextUrl.pathname, request.method)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/account";
    url.search = "";
    applyFlash(url, "error", "Please choose a new password before continuing.");
    return withCsp(NextResponse.redirect(url));
  }
  return withCsp(response);
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/login/:path*"],
};
