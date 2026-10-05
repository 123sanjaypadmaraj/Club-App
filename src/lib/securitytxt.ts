/** RFC 9116 security.txt body. Returns null when no contact is configured (the route then 404s). */
export function securityTxt(o: { contact: string | undefined; siteUrl: string | undefined; now: Date }): string | null {
  const contact = o.contact?.trim();
  if (!contact || !/^(mailto:|https:\/\/)\S+$/i.test(contact)) return null;
  const expires = new Date(o.now.getTime() + 180 * 86_400_000).toISOString();
  const lines = [`Contact: ${contact}`, `Expires: ${expires}`, "Preferred-Languages: en"];
  const site = o.siteUrl?.trim().replace(/\/+$/, "");
  if (site && /^https:\/\//i.test(site)) lines.push(`Canonical: ${site}/.well-known/security.txt`);
  return lines.join("\n") + "\n";
}
