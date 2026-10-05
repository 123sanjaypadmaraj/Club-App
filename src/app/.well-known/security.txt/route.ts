import { securityTxt } from "@/lib/securitytxt";

export const dynamic = "force-dynamic";

export function GET() {
  const body = securityTxt({ contact: process.env.SECURITY_CONTACT, siteUrl: process.env.NEXT_PUBLIC_SITE_URL, now: new Date() });
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
