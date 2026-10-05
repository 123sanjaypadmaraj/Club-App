import { readFlash } from "@/lib/flash";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { safeNextPath } from "@/lib/redirect";
import { SubmitButton } from "@/components/SubmitButton";
import { Field, Notice } from "@/components/ui";
import { verifyMfaLoginAction } from "./actions";

export const metadata = { title: "Two-step login", robots: { index: false, follow: false } };

export default async function MfaPage({ searchParams }: PageProps<"/login/mfa">) {
  if (!(await getProfile())) redirect("/login");
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : "/dashboard");
  return (
    <div className="card mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-bold tracking-tight">Two-step login</h1>
      <p className="text-sm text-muted">Open your authenticator app and enter the 6-digit code for Club Hub.</p>
      <Notice error={readFlash(sp).error} />
      <form action={verifyMfaLoginAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="6-digit code">
          <input name="code" required autoFocus inputMode="numeric" pattern="[0-9 ]{6,7}" maxLength={7} autoComplete="one-time-code" className="input text-center text-lg tracking-widest" />
        </Field>
        <SubmitButton className="btn btn-primary w-full" pendingText="Checking…">Verify</SubmitButton>
      </form>
    </div>
  );
}
