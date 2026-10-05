/** What a Supabase API key can do: "service_role" bypasses row-level security and must never reach a browser. */
export function keyRole(key: string | undefined): "service_role" | "anon" | "unknown" {
  if (!key) return "unknown";
  if (key.startsWith("sb_secret_")) return "service_role";
  if (key.startsWith("sb_publishable_")) return "anon";
  const parts = key.split(".");
  if (parts.length !== 3) return "unknown";
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as { role?: unknown };
    return payload.role === "service_role" ? "service_role" : payload.role === "anon" ? "anon" : "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Ask Supabase whether public sign-ups are open. Every account here is created by an admin, so open sign-ups would let
 * anyone with the public key create a login. Returns a problem name, or null when sign-ups are disabled.
 */
export async function checkAuthSettings(url: string, anonKey: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetchImpl(`${url.replace(/\/+$/, "")}/auth/v1/settings`, { headers: { apikey: anonKey }, signal: AbortSignal.timeout(5_000) });
    const json = (await res.json()) as { disable_signup?: unknown };
    return json.disable_signup === true ? null : "public_signup_enabled";
  } catch {
    return "auth_settings_unreadable";
  }
}

export type ConfigReport = { fatal: string[]; warnings: string[] };

/** Inspect the environment. `fatal` problems stop the server; `warnings` are logged as security events in production. */
export function checkConfig(env: Record<string, string | undefined>, production: boolean): ConfigReport {
  const fatal: string[] = [];
  const warnings: string[] = [];

  if (!env.NEXT_PUBLIC_SUPABASE_URL) fatal.push("NEXT_PUBLIC_SUPABASE_URL is not set");
  else if (production && !/^https:\/\//i.test(env.NEXT_PUBLIC_SUPABASE_URL)) warnings.push("supabase_url_not_https");
  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) fatal.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");

  // the service-role key pasted into a browser-visible variable would disable row-level security for every visitor
  if (keyRole(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) === "service_role") fatal.push("NEXT_PUBLIC_SUPABASE_ANON_KEY holds a service-role key: use the anon/publishable key there");
  const secret = env.SUPABASE_SERVICE_ROLE_KEY;
  if (secret) {
    const leaked = Object.keys(env).filter((k) => k.startsWith("NEXT_PUBLIC_") && env[k] === secret);
    if (leaked.length) fatal.push(`SUPABASE_SERVICE_ROLE_KEY value is also set in ${leaked.join(", ")}`);
  }

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
