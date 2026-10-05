"use server";

import { flashQuery } from "@/lib/flash";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LAST_SEEN_COOKIE, lastSeenCookieOptions } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loginEmail } from "@/lib/username";
import { safeNextPath } from "@/lib/redirect";
import { clientIp, LIMITS_POLICY, rateLimit } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { logSecurityEvent } from "@/lib/log";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";

export async function signIn(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "/dashboard"));
  const fail = (msg: string): never => redirect(`/login?${flashQuery("error", msg)}&next=${encodeURIComponent(next)}`);

  if (!username || !password || username.length > 120 || password.length > 256) return fail("Invalid username or password.");

  const ip = await clientIp();
  const tooMany = "Too many sign-in attempts. Please wait 15 minutes and try again.";
  if (!(await rateLimit("login-ip", ip, LIMITS_POLICY.login.max, LIMITS_POLICY.login.window))) return fail(tooMany);
  // CAPTCHA before the per-account budget is spent, so bots cannot lock a real user out by spamming their username
  if (!(await verifyTurnstile(formData.get("cf-turnstile-response"), ip, "login"))) return fail("Please complete the verification and try again.");
  const userOk =
    (await rateLimit("login-user", username, LIMITS_POLICY.loginUser.max, LIMITS_POLICY.loginUser.window)) &&
    (await rateLimit("login-user-day", username, LIMITS_POLICY.loginUserDay.max, LIMITS_POLICY.loginUserDay.window));
  if (!userOk) {
    logSecurityEvent("login_account_throttled");
    return fail(tooMany); // same message whether or not the account exists
  }

  const supabase = await createClient();
  const { data: signed, error } = await supabase.auth.signInWithPassword({ email: loginEmail(username), password });
  if (error) {
    logSecurityEvent("login_failed");
    return fail("Invalid username or password.");
  }

  if (signed.user) await audit(signed.user.id, AUDIT_ACTIONS.login, signed.user.id);
  (await cookies()).set(LAST_SEEN_COOKIE, String(Date.now()), lastSeenCookieOptions()); // start the idle clock fresh
  // accounts with two-step login enabled must pass the second step before they get anywhere
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") redirect(`/login/mfa?next=${encodeURIComponent(next)}`);
  redirect(next);
}

/** End this session and every other one (lost laptop, shared computer). */
export async function signOutEverywhereAction() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  await audit(data.user.id, AUDIT_ACTIONS.logoutEverywhere, data.user.id);
  await supabase.auth.signOut({ scope: "global" });
  (await cookies()).delete(LAST_SEEN_COOKIE);
  redirect("/login?" + flashQuery("error", "You were signed out of all devices. Sign in again."));
}

export async function signOut() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) await audit(data.user.id, AUDIT_ACTIONS.logout, data.user.id);
  await supabase.auth.signOut();
  (await cookies()).delete(LAST_SEEN_COOKIE);
  redirect("/");
}
