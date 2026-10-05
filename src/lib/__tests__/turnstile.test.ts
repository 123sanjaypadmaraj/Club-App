import { afterEach, describe, expect, it, vi } from "vitest";
import { checkSiteverify, verifyTurnstile } from "@/lib/turnstile";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function configured() {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "s");
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "k");
}
const answer = (json: object) => vi.fn().mockResolvedValue({ json: async () => json });

describe("verifyTurnstile", () => {
  it("skips the check when keys are not configured", async () => {
    expect(await verifyTurnstile(null, "1.2.3.4", "login")).toBe(true);
  });
  it("fails when configured and the token is missing", async () => {
    configured();
    expect(await verifyTurnstile(null, "1.2.3.4", "login")).toBe(false);
  });
  it("passes only on success for the right action", async () => {
    configured();
    vi.stubGlobal("fetch", answer({ success: true, action: "login" }));
    expect(await verifyTurnstile("tok", "1.2.3.4", "login")).toBe(true);
    vi.stubGlobal("fetch", answer({ success: false }));
    expect(await verifyTurnstile("tok", "1.2.3.4", "login")).toBe(false);
  });
  it("refuses a token solved for a different form", async () => {
    configured();
    vi.stubGlobal("fetch", answer({ success: true, action: "feedback" }));
    expect(await verifyTurnstile("tok", "1.2.3.4", "login")).toBe(false);
  });
  it("fails closed when the verifier is unreachable", async () => {
    configured();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await verifyTurnstile("tok", "1.2.3.4", "login")).toBe(false);
  });
});

describe("checkSiteverify", () => {
  const ok = { success: true, action: "login", hostname: "club.example.com" };
  it("accepts a matching result", () => expect(checkSiteverify(ok, { action: "login", siteUrl: "https://club.example.com" })).toBeNull());
  it("rejects success:false", () => expect(checkSiteverify({ success: false }, { action: "login" })).toBe("failed"));
  it("rejects the wrong action", () => expect(checkSiteverify(ok, { action: "register" })).toBe("action"));
  it("rejects the wrong hostname when a site URL is set", () => {
    expect(checkSiteverify({ ...ok, hostname: "evil.test" }, { action: "login", siteUrl: "https://club.example.com" })).toBe("hostname");
  });
  it("allows any hostname when no site URL is set (preview deploys)", () => {
    expect(checkSiteverify({ ...ok, hostname: "preview-123.vercel.app" }, { action: "login" })).toBeNull();
  });
});
