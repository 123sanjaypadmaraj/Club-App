import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  ...(process.env.NEXT_PUBLIC_SITE_URL ? { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL) } : {}),
  title: { default: "Club Hub", template: "%s · Club Hub" },
  description: "Every co-curricular club on campus — events, registrations, feedback and performance in one place.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const profile = await getProfile();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-20 print:hidden border-b border-line bg-surface/90 backdrop-blur">
          <div aria-hidden className="h-1 bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-orange-500" />
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight">
              Club<span className="gradient-text">Hub</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm text-muted">
              <Link href="/" className="rounded-md px-2.5 py-1.5 hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-300">Clubs</Link>
              <Link href="/events" className="rounded-md px-2.5 py-1.5 hover:bg-fuchsia-500/10 hover:text-fuchsia-600 dark:hover:text-fuchsia-300">Events</Link>
            </nav>
            <div className="ml-auto flex items-center gap-2 text-sm">
              {profile ? (
                <>
                  <Link href="/dashboard" className="btn">
                    {profile.role === "super_admin" ? "Admin dashboard" : "My club"}
                  </Link>
                  <form action={signOut}>
                    <button className="btn" type="submit">Sign out</button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="btn btn-primary">Club login</Link>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-line bg-gradient-to-r from-indigo-500/10 via-fuchsia-500/10 to-orange-500/10 py-6 print:hidden text-center text-xs text-muted">Club Hub · co-curricular clubs portal</footer>
      </body>
    </html>
  );
}
