import { describe, expect, it } from "vitest";
import { checkAuthSettings, checkConfig, keyRole } from "../config-check";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (role: string) => `${b64({ alg: "HS256" })}.${b64({ role })}.sig`;

describe("keyRole", () => {
  it("reads the role from a JWT", () => {
    expect(keyRole(jwt("service_role"))).toBe("service_role");
    expect(keyRole(jwt("anon"))).toBe("anon");
    expect(keyRole(jwt("other"))).toBe("unknown");
  });
  it("recognises the new key prefixes", () => {
    expect(keyRole("sb_secret_abc")).toBe("service_role");
    expect(keyRole("sb_publishable_abc")).toBe("anon");
  });
  it("treats junk as unknown", () => {
    for (const k of [undefined, "", "abc", "a.b.c", "a.!!!.c"]) expect(keyRole(k)).toBe("unknown");
  });
});

const base = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("anon") };

describe("checkConfig key rules", () => {
  it("is fatal when the anon key is really a service-role key", () => {
    const r = checkConfig({ ...base, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("service_role") }, true);
    expect(r.fatal.join(" ")).toMatch(/service-role/);
    expect(r.fatal.join(" ")).not.toContain(jwt("service_role")); // names only, never values
  });
  it("is fatal when the secret value is repeated in a NEXT_PUBLIC variable", () => {
    const r = checkConfig({ ...base, SUPABASE_SERVICE_ROLE_KEY: "s3cret", NEXT_PUBLIC_OOPS: "s3cret" }, false);
    expect(r.fatal.join(" ")).toContain("NEXT_PUBLIC_OOPS");
    expect(r.fatal.join(" ")).not.toContain("s3cret");
  });
  it("accepts a normal setup", () => {
    expect(checkConfig({ ...base, SUPABASE_SERVICE_ROLE_KEY: jwt("service_role") }, false).fatal).toEqual([]);
  });
});

describe("checkAuthSettings", () => {
  const stub = (body: unknown): typeof fetch => (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;
  it("flags open sign-ups", async () => expect(await checkAuthSettings("https://x", "k", stub({ disable_signup: false }))).toBe("public_signup_enabled"));
  it("passes when sign-ups are disabled", async () => expect(await checkAuthSettings("https://x", "k", stub({ disable_signup: true }))).toBeNull());
  it("reports unreadable settings", async () => {
    const boom = (async () => { throw new Error("down"); }) as unknown as typeof fetch;
    expect(await checkAuthSettings("https://x", "k", boom)).toBe("auth_settings_unreadable");
  });
});
