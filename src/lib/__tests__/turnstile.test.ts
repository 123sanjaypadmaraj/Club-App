import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "@/lib/turnstile";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function configured() {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "s");
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "k");
}

describe("verifyTurnstile", () => {
  it("skips the check when keys are not configured", async () => {
    expect(await verifyTurnstile(null, "1.2.3.4")).toBe(true);
  });
  it("fails when configured and the token is missing", async () => {
    configured();
    expect(await verifyTurnstile(null, "1.2.3.4")).toBe(false);
  });
  it("passes only on success from the verifier", async () => {
    configured();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ success: true }) }));
    expect(await verifyTurnstile("tok", "1.2.3.4")).toBe(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ success: false }) }));
    expect(await verifyTurnstile("tok", "1.2.3.4")).toBe(false);
  });
  it("fails closed when the verifier is unreachable", async () => {
    configured();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await verifyTurnstile("tok", "1.2.3.4")).toBe(false);
  });
});
