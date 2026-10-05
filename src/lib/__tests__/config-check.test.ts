import { describe, expect, it } from "vitest";
import { checkConfig } from "../config-check";

const ok = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k", SUPABASE_SERVICE_ROLE_KEY: "s", TURNSTILE_SECRET_KEY: "t", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "p" };

describe("checkConfig", () => {
  it("accepts a complete production config", () => expect(checkConfig(ok, true)).toEqual({ fatal: [], warnings: [] }));
  it("fails without Supabase settings", () => {
    expect(checkConfig({}, false).fatal).toHaveLength(2);
  });
  it("fails when a service-role key is exposed to the browser", () => {
    expect(checkConfig({ ...ok, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "s" }, false).fatal.join(" ")).toMatch(/exposed/i);
  });
  it("warns about risky production settings", () => {
    const r = checkConfig({ ...ok, TURNSTILE_SECRET_KEY: "", ADMIN_MFA: "off", SUPABASE_SERVICE_ROLE_KEY: "" }, true);
    expect(r.warnings.sort()).toEqual(["admin_mfa_disabled", "captcha_not_configured", "service_role_key_missing"]);
  });
  it("does not warn in development", () => expect(checkConfig({ ...ok, ADMIN_MFA: "off" }, false).warnings).toEqual([]));
});
