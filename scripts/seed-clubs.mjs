// Loads the real clubs (name, logo, links, real site info) from data/clubs.json straight into Supabase.
//   node --env-file=.env.production.local --env-file=.env.local scripts/seed-clubs.mjs
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Existing clubs are updated in place.
// Removes the 20 generic starter clubs from the old seed. Adds no events, members or simulated data.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const { clubs } = JSON.parse(readFileSync(join(root, "data/clubs.json"), "utf8"));

const PLACEHOLDERS = [
  "coding-club", "robotics-club", "ai-ml-club", "cybersec-club", "electronics-club", "gdsc-club", "drama-club",
  "music-club", "dance-club", "literary-club", "photography-club", "film-club", "art-club", "sports-club",
  "chess-club", "nss-club", "eco-club", "entrepreneur-cell", "finance-club", "quiz-club",
];

const { error: delErr } = await sb.from("clubs").delete().in("slug", PLACEHOLDERS);
if (delErr) { console.error("Could not remove starter clubs:", delErr.message); process.exit(1); }

const rows = clubs.map((c) => ({
  slug: c.slug, name: c.name, category: c.category, tagline: c.tagline, description: c.description,
  logo_url: c.logo ? `/logos/${c.slug}.${c.logo.split(".").pop()}` : null, accent_color: c.accent,
  website_url: c.website ?? null, instagram_url: c.instagram ?? null, linkedin_url: c.linkedin ?? null,
  ...(c.founded ? { founded_year: c.founded } : {}), is_active: true,
}));
const { error } = await sb.from("clubs").upsert(rows, { onConflict: "slug" });
if (error) { console.error("Could not save clubs:", error.message); process.exit(1); }
console.log(`Loaded ${rows.length} clubs; removed the generic starter clubs.`);
