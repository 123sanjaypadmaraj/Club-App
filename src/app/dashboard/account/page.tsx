import { readFlash } from "@/lib/flash";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MfaSetup } from "./MfaSetup";
import { SubmitButton } from "@/components/SubmitButton";
import { Field, Notice, PageHeader } from "@/components/ui";
import { changePasswordAction } from "@/app/dashboard/actions";
import { removeMfaFactorAction } from "@/app/login/mfa/actions";
import { signOutEverywhereAction } from "@/app/login/actions";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "My account" };

export default async function AccountPage({ searchParams }: PageProps<"/dashboard/account">) {
  const sp = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = (factors?.totp ?? []).filter((f) => f.status === "verified");
  const mfaOn = verified.length > 0;
  return (
    <div className="max-w-md space-y-4">
      <PageHeader title="My account" subtitle={profile.email ?? undefined} />
      <Notice {...readFlash(sp)} />
      <section className="card space-y-3">
        <h2 className="font-semibold">Two-step login</h2>
        {mfaOn ? (
          <>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">On. You will be asked for a code from your authenticator app each time you sign in.</p>
            <ul className="space-y-2">
              {verified.map((f) => (
                <li key={f.id} className="rounded-lg border border-line p-3 text-sm">
                  <div className="font-medium">{f.friendly_name || "Authenticator"} <span className="text-muted">· added {fmtDate(f.created_at)}</span></div>
                  <form action={removeMfaFactorAction} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="factor_id" value={f.id} />
                    <input name="code" required inputMode="numeric" pattern="[0-9 ]{6,7}" maxLength={7} autoComplete="one-time-code" placeholder="6-digit code" aria-label={`Code to remove ${f.friendly_name || "authenticator"}`} className="input w-36" />
                    <SubmitButton className="btn" pendingText="Removing…">Remove</SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
            <details>
              <summary className="cursor-pointer text-sm text-muted hover:text-foreground">Add a backup authenticator</summary>
              <div className="mt-2"><MfaSetup /></div>
            </details>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              Adds a code from your phone on top of your password, so a stolen password alone is not enough.
              {profile.role === "super_admin" ? " Required for admin accounts." : " Recommended for everyone."}
            </p>
            <MfaSetup />
          </>
        )}
      </section>
      <form action={signOutEverywhereAction} className="card space-y-3">
        <h2 className="font-semibold">Sign out of all devices</h2>
        <p className="text-sm text-muted">Use this if you left yourself signed in on a shared or lost computer. You will need to sign in again here too.</p>
        <SubmitButton className="btn" pendingText="Signing out…">Sign out everywhere</SubmitButton>
      </form>
      <form action={changePasswordAction} className="card space-y-4">
        <h2 className="font-semibold">Change password</h2>
        <Field label="Current password"><input name="current" type="password" required autoComplete="current-password" className="input" /></Field>
        <Field label="New password (min 12 characters)"><input name="next" type="password" required minLength={12} autoComplete="new-password" className="input" /></Field>
        <Field label="Confirm new password"><input name="confirm" type="password" required minLength={12} autoComplete="new-password" className="input" /></Field>
        <SubmitButton className="btn btn-primary" pendingText="Saving…">Update password</SubmitButton>
      </form>
    </div>
  );
}
