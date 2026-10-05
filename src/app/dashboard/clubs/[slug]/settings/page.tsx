import { readFlash } from "@/lib/flash";
import { requireClubAccess } from "@/lib/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { Field, Notice, PageHeader } from "@/components/ui";
import { saveClubAction } from "@/app/dashboard/actions";

export const metadata = { title: "Club settings" };

export default async function SettingsTab({ params, searchParams }: PageProps<"/dashboard/clubs/[slug]/settings">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { club, profile } = await requireClubAccess(slug);
  const isAdmin = profile.role === "super_admin";

  return (
    <>
      <PageHeader title="Club settings" subtitle="This information appears on the public club page." />
      <Notice {...readFlash(sp)} />
      <form action={saveClubAction.bind(null, slug)} className="card grid gap-4 sm:grid-cols-2">
        <Field label="Club name *"><input name="name" required maxLength={80} defaultValue={club.name} className="input" /></Field>
        <Field label="Tagline"><input name="tagline" maxLength={140} defaultValue={club.tagline ?? ""} className="input" /></Field>
        <div className="sm:col-span-2"><Field label="About"><textarea name="description" rows={4} maxLength={2000} defaultValue={club.description ?? ""} className="input" /></Field></div>
        <Field label="Contact email"><input name="contact_email" type="email" defaultValue={club.contact_email ?? ""} className="input" /></Field>
        <Field label="Faculty advisor"><input name="faculty_advisor" maxLength={120} defaultValue={club.faculty_advisor ?? ""} className="input" /></Field>
        <Field label="Meeting schedule"><input name="meeting_schedule" maxLength={160} defaultValue={club.meeting_schedule ?? ""} className="input" placeholder="Fridays 5 PM" /></Field>
        <Field label="Founded (year)"><input name="founded_year" type="number" min={1900} max={2100} defaultValue={club.founded_year ?? ""} className="input" /></Field>
        <Field label="Join-the-club form" hint="Link to your membership / recruitment form"><input name="join_form_url" defaultValue={club.join_form_url ?? ""} className="input" /></Field>
        <Field label="Instagram"><input name="instagram_url" defaultValue={club.instagram_url ?? ""} className="input" /></Field>
        <Field label="LinkedIn"><input name="linkedin_url" defaultValue={club.linkedin_url ?? ""} className="input" /></Field>
        <Field label="WhatsApp group"><input name="whatsapp_url" defaultValue={club.whatsapp_url ?? ""} className="input" /></Field>
        <Field label="Website"><input name="website_url" defaultValue={club.website_url ?? ""} className="input" /></Field>
        <Field label="Accent colour"><input name="accent_color" type="color" defaultValue={club.accent_color} className="h-10 w-20 cursor-pointer rounded border border-line bg-surface" /></Field>
        {isAdmin && (
          <>
            <Field label="Category (admin only)"><input name="category" defaultValue={club.category} className="input" /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={club.is_active} /> Club is active (shown publicly)</label>
          </>
        )}
        <div className="sm:col-span-2"><SubmitButton>Save settings</SubmitButton></div>
      </form>
    </>
  );
}
