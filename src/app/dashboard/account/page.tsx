import { requireProfile } from "@/lib/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { Field, Notice, PageHeader } from "@/components/ui";
import { changePasswordAction } from "@/app/dashboard/actions";

export const metadata = { title: "My account" };

export default async function AccountPage({ searchParams }: PageProps<"/dashboard/account">) {
  const sp = await searchParams;
  const profile = await requireProfile();
  return (
    <div className="max-w-md space-y-4">
      <PageHeader title="My account" subtitle={profile.email ?? undefined} />
      <Notice ok={typeof sp.ok === "string" ? sp.ok : undefined} error={typeof sp.error === "string" ? sp.error : undefined} />
      <form action={changePasswordAction} className="card space-y-4">
        <h2 className="font-semibold">Change password</h2>
        <Field label="Current password"><input name="current" type="password" required autoComplete="current-password" className="input" /></Field>
        <Field label="New password (min 8 characters)"><input name="next" type="password" required minLength={8} autoComplete="new-password" className="input" /></Field>
        <Field label="Confirm new password"><input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" /></Field>
        <SubmitButton className="btn btn-primary" pendingText="Saving…">Update password</SubmitButton>
      </form>
    </div>
  );
}
