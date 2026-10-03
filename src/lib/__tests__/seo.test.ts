import { describe, expect, it } from "vitest";
import { buildSitemap, eventInSitemapWindow, eventJsonLd, jsonLdString, siteOrigin } from "../seo";

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

describe("eventJsonLd", () => {
  const club = { slug: "chess", name: "Chess Club" };
  const base = { id: "e1", title: "Blitz", starts_at: "2026-11-01T10:00:00Z", ends_at: null, venue: null, description: null, status: "published" };
  it("builds a scheduled event with origin", () => {
    const o = eventJsonLd({ ...base, venue: "Hall A", ends_at: "2026-11-01T12:00:00Z" }, club, "https://x.test");
    expect(o.eventStatus).toBe("https://schema.org/EventScheduled");
    expect(o.location).toEqual({ "@type": "Place", name: "Hall A" });
    expect(o.endDate).toBe("2026-11-01T12:00:00.000Z");
    expect(o.url).toBe("https://x.test/events/e1");
    expect(o.organizer).toEqual({ "@type": "Organization", name: "Chess Club", url: "https://x.test/clubs/chess" });
  });
  it("marks cancelled and omits venue/origin/description", () => {
    const o = eventJsonLd({ ...base, status: "cancelled" }, club, null);
    expect(o.eventStatus).toBe("https://schema.org/EventCancelled");
    expect(o).not.toHaveProperty("location");
    expect(o).not.toHaveProperty("url");
    expect(o).not.toHaveProperty("description");
    expect(o.organizer).toEqual({ "@type": "Organization", name: "Chess Club" });
  });
  it("truncates long descriptions", () => {
    const o = eventJsonLd({ ...base, description: "a".repeat(500) }, club, null);
    expect((o.description as string).length).toBe(300);
  });
  it("escapes < so data cannot close the script tag", () => {
    expect(jsonLdString({ a: "</script><b>" })).not.toContain("<");
    expect(JSON.parse(jsonLdString({ a: "</script>" }))).toEqual({ a: "</script>" });
  });
});
