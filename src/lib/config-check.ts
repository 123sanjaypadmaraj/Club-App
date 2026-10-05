export type ConfigReport = { fatal: string[]; warnings: string[] };

/** Inspect the environment. `fatal` problems stop the server; `warnings` are logged as security events in production. */
export function checkConfig(env: Record<string, string | undefined>, production: boolean): ConfigReport {
  const fatal: string[] = [];
  const warnings: string[] = [];

  if (!env.NEXT_PUBLIC_SUPABASE_URL) fatal.push("NEXT_PUBLIC_SUPABASE_URL is not set");
  else if (production && !/^https:\/\//i.test(env.NEXT_PUBLIC_SUPABASE_URL)) warnings.push("supabase_url_not_https");
  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) fatal.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");

  // a service-role key under a NEXT_PUBLIC_ name would be shipped to every browser
  const exposed = Object.keys(env).filter((k) => k.startsWith("NEXT_PUBLIC_") && /service[_-]?role/i.test(k));
  if (exposed.length) fatal.push(`Service-role key exposed through ${exposed.join(", ")}: rename it without the NEXT_PUBLIC_ prefix`);

  if (production) {
    if (!env.SUPABASE_SERVICE_ROLE_KEY) warnings.push("service_role_key_missing");
    if (!env.TURNSTILE_SECRET_KEY || !env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) warnings.push("captcha_not_configured");
    if (env.ADMIN_MFA === "off") warnings.push("admin_mfa_disabled");
  }
  return { fatal, warnings };
}
