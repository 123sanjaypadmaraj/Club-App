import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Club login" };

const perks = [
  { icon: "📅", text: "Create and manage your club's events" },
  { icon: "✅", text: "Track registrations and check-ins" },
  { icon: "📊", text: "See feedback and performance at a glance" },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getProfile()) redirect("/dashboard");
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/dashboard";
  const error = typeof sp.error === "string" ? sp.error : undefined;
  return (
    <div className="relative mx-auto grid max-w-4xl items-stretch overflow-hidden rounded-2xl border border-line bg-surface shadow-xl shadow-indigo-500/10 animate-rise md:grid-cols-5">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-fuchsia-600 to-orange-500 p-8 text-white md:col-span-2 md:flex md:flex-col md:justify-between">
        <div aria-hidden className="animate-float absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/15 blur-sm" />
        <div aria-hidden className="animate-float-slow absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-white/10 blur-sm" />
        <div className="relative">
          <p className="text-2xl font-bold tracking-tight">ClubHub</p>
          <p className="mt-2 text-sm text-white/80">Everything your club needs, in one place.</p>
        </div>
        <ul className="relative space-y-4 text-sm">
          {perks.map((p) => (
            <li key={p.text} className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/20 text-base backdrop-blur">{p.icon}</span>
              {p.text}
            </li>
          ))}
        </ul>
      </aside>

      <section className="p-6 sm:p-10 md:col-span-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome <span className="gradient-text">back</span>
        </h1>
        <p className="mb-7 mt-1.5 text-sm text-muted">For club leads and the club admin. Accounts are created by the admin.</p>
        <LoginForm next={next} error={error} />
      </section>
    </div>
  );
}
