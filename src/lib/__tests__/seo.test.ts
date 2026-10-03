import { describe, expect, it } from "vitest";
import { buildSitemap, eventInSitemapWindow, siteOrigin } from "../seo";

const now = new Date("2026-10-04T00:00:00Z");

describe("siteOrigin", () => {
  it("normalises valid URLs and rejects junk", () => {
    expect(siteOrigin("https://club.example.com/")).toBe("https://club.example.com");
    expect(siteOrigin(undefined)).toBeNull();
    expect(siteOrigin("  ")).toBeNull();
    expect(siteOrigin("not a url")).toBeNull();
    expect(siteOrigin("javascript:alert(1)")).toBeNull();
  });
});

describe("buildSitemap", () => {
  it("is empty without an origin", () => {
    expect(buildSitemap(null, [{ slug: "a" }], [], now)).toEqual([]);
  });
  it("lists static pages, clubs and events inside the 180-day window", () => {
    const out = buildSitemap(
      "https://x.test",
      [{ slug: "chess club" }],
      [
        { id: "new", starts_at: "2026-11-01T00:00:00Z", created_at: "2026-09-01T00:00:00Z" },
        { id: "old", starts_at: "2025-01-01T00:00:00Z" },
      ],
      now,
    );
    expect(out.map((e) => e.url)).toEqual([
      "https://x.test/",
      "https://x.test/events",
      "https://x.test/clubs/chess%20club",
      "https://x.test/events/new",
    ]);
    expect(out[3].lastModified).toEqual(new Date("2026-09-01T00:00:00Z"));
  });
  it("window boundary and bad dates", () => {
    expect(eventInSitemapWindow("2026-04-10T00:00:00Z", now)).toBe(true);
    expect(eventInSitemapWindow("2026-04-01T00:00:00Z", now)).toBe(false);
    expect(eventInSitemapWindow("garbage", now)).toBe(false);
  });
});
