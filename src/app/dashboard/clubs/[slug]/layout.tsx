import Link from "next/link";
import { requireClubAccess } from "@/lib/auth";
import { ClubTabs } from "@/components/ClubTabs";

export default async function ClubLayout({ children, params }: LayoutProps<"/dashboard/clubs/[slug]">) {
  const { slug } = await params;
  const { club } = await requireClubAccess(slug);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="size-3 rounded-full" style={{ background: club.accent_color }} />
          <h1 className="text-2xl font-bold tracking-tight">{club.name}</h1>
          <span className="badge">{club.category}</span>
          {!club.is_active && <span className="badge text-muted">Inactive</span>}
        </div>
        <Link href={`/clubs/${club.slug}`} className="text-sm text-brand hover:underline">View public page ↗</Link>
      </div>
      <ClubTabs slug={slug} />
      {children}
    </div>
  );
}
