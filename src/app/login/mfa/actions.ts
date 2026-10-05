"use server";

import { redirect } from "next/navigation";
import { getProfile, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/redirect";
import { LIMITS_POLICY, rateLimit } from "@/lib/ratelimit";
import { logActionError, logSecurityEvent } from "@/lib/log";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import { canRemoveFactor } from "@/lib/mfaguard";

export type MfaResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const CODE = /^\d{6}$/;

/** Second step of sign-in: check the 6-digit code from the authenticator app. */
export async function verifyMfaLoginAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile) return redirect("/login");
  const next = safeNextPath(String(formData.get("next") ?? "/dashboard"));
  const back = (msg: string): never => redirect(`/login/mfa?error=${encodeURIComponent(msg)}&next=${encodeURIComponent(next)}`);

  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!CODE.test(code)) return back("Enter the 6-digit code from your authenticator app.");
  if (!(await rateLimit("mfa", profile.id, LIMITS_POLICY.mfa.max, LIMITS_POLICY.mfa.window))) return back("Too many attempts. Please wait a few minutes and try again.");

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find((f) => f.status === "verified");
  if (!factor) return redirect("/dashboard/account");

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) {
    logSecurityEvent("mfa_failed");
    return back("That code is not correct. Try the newest code.");
  }
  await audit(profile.id, AUDIT_ACTIONS.mfaVerified, profile.id);
  return redirect(next);
}

/** Start setting up an authenticator app: returns the QR code (SVG data URI) and the manual-entry secret. */
export async function startMfaEnrollAction(): Promise<MfaResult<{ factorId: string; qr: string; secret: string }>> {
  await requireProfile();
  const supabase = await createClient();

  // drop abandoned half-finished set-ups so they do not pile up
  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const f of existing?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${Date.now()}` });
  if (error || !data) {
    logActionError("startMfaEnrollAction", error);
    return { ok: false, error: "Could not start setup. Check that two-step login (TOTP) is enabled in Supabase Auth settings." };
  }
  return { ok: true, factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Finish set-up by proving the app produces a valid code. This also upgrades the current session. */
export async function confirmMfaEnrollAction(factorId: string, code: string): Promise<MfaResult> {
  const profile = await requireProfile();
  const clean = code.replace(/\s/g, "");
  if (!CODE.test(clean)) return { ok: false, error: "Enter the 6-digit code." };
  if (!(await rateLimit("mfa", profile.id, LIMITS_POLICY.mfa.max, LIMITS_POLICY.mfa.window))) return { ok: false, error: "Too many attempts. Please wait a few minutes." };

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: clean });
  if (error) { logSecurityEvent("mfa_enroll_failed"); return { ok: false, error: "That code is not correct. Try the newest code." }; }
  await audit(profile.id, AUDIT_ACTIONS.mfaEnabled, profile.id);
  return { ok: true };
}

/** Remove one of the user's authenticators. Needs a fresh code from that same authenticator; admins keep at least one. */
export async function removeMfaFactorAction(formData: FormData) {
  const profile = await requireProfile();
  const back = (kind: "ok" | "error", msg: string): never => redirect(`/dashboard/account?${kind}=${encodeURIComponent(msg)}`);
  const factorId = String(formData.get("factor_id") ?? "");
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^[0-9a-f-]{36}$/i.test(factorId)) return back("error", "Pick an authenticator.");
  if (!CODE.test(code)) return back("error", "Enter the 6-digit code from that authenticator.");
  if (!(await rateLimit("mfa", profile.id, LIMITS_POLICY.mfa.max, LIMITS_POLICY.mfa.window))) return back("error", "Too many attempts. Please wait a few minutes.");

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp.filter((f) => f.status === "verified") ?? [];
  if (!verified.some((f) => f.id === factorId)) return back("error", "That authenticator was not found.");
  if (!canRemoveFactor({ role: profile.role, verifiedCount: verified.length, adminMfaOff: process.env.ADMIN_MFA === "off" })) {
    return back("error", "Add another authenticator first. Admin accounts must keep one.");
  }
  const { error: verr } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (verr) { logSecurityEvent("mfa_failed"); return back("error", "That code is not correct. Try the newest code."); }
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) { logActionError("removeMfaFactorAction", error, { userId: profile.id }); return back("error", "Could not remove the authenticator."); }
  await audit(profile.id, AUDIT_ACTIONS.mfaRemoved, profile.id);
  return back("ok", "Authenticator removed.");
}
