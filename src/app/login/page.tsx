import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { Field, Notice } from "@/components/ui";
import { signIn } from "./actions";

export const metadata = { title: "Club login" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getProfile()) redirect("/dashboard");
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/dashboard";
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-2xl font-bold">Club login</h1>
      <p className="mb-6 text-sm text-muted">For club leads and the club admin. Accounts are created by the admin.</p>
      <Notice error={typeof sp.error === "string" ? sp.error : undefined} />
      <form action={signIn} className="card space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email">
          <input name="email" type="email" required autoComplete="email" className="input" />
        </Field>
        <Field label="Password">
          <input name="password" type="password" required autoComplete="current-password" className="input" />
        </Field>
        <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
      </form>
    </div>
  );
}
