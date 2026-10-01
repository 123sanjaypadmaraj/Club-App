import { requireProfile } from "@/lib/auth";
import { DashNav } from "@/components/DashNav";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const profile = await requireProfile();
  return (
    <div>
      <DashNav isAdmin={profile.role === "super_admin"} />
      {children}
    </div>
  );
}
