// Re-scrapes every club's page on newhorizonindia.edu and reports what changed since the last run.
//   node scripts/scrape-clubs.mjs            # fetch, refresh social links in data/clubs.json, print text changes
//   node scripts/build-seed.mjs              # then regenerate the SQL seeds
// Page text is snapshotted to data/snapshots/<slug>.txt so the next run can diff against it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "data/clubs.json");
const data = JSON.parse(readFileSync(file, "utf8"));
const snapDir = join(root, "data/snapshots");
mkdirSync(snapDir, { recursive: true });

const decode = (s) => s.replace(/&#0?38;|&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "’").replace(/&#8220;|&#8221;/g, '"').replace(/&nbsp;/g, " ").replace(/&#\d+;/g, "");

function toLines(html) {
  const body = html
    .replace(/<(script|style|noscript|svg|nav|header|footer)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(p|div|li|h\d|tr)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decode(body).split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length > 2);
}

const social = (html, host) => {
  const m = html.match(new RegExp(`https?://(?:www\\.)?${host}/[^"'\\s<>]+`, "i"));
  return m ? decode(m[0]).split("?")[0] : null;
};

let changed = 0;
for (const club of data.clubs) {
  let html;
  try {
    const res = await fetch(club.website, { headers: { "user-agent": "Mozilla/5.0 (ClubHub scraper)" }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    console.warn(`! ${club.slug}: ${err.message}`);
    continue;
  }

  const ig = social(html, "instagram\\.com");
  const li = social(html, "linkedin\\.com");
  if (ig && ig !== club.instagram) { console.log(`~ ${club.slug}: instagram → ${ig}`); club.instagram = ig; changed++; }
  if (li && li !== club.linkedin) { console.log(`~ ${club.slug}: linkedin → ${li}`); club.linkedin = li; changed++; }

  const lines = toLines(html);
  const snap = join(snapDir, `${club.slug}.txt`);
  if (existsSync(snap)) {
    const old = new Set(readFileSync(snap, "utf8").split("\n"));
    const fresh = lines.filter((l) => !old.has(l));
    if (fresh.length) {
      console.log(`+ ${club.slug}: ${fresh.length} new line(s) on the site — review and fold into data/clubs.json:`);
      fresh.slice(0, 12).forEach((l) => console.log(`    ${l.slice(0, 140)}`));
    }
  } else {
    console.log(`• ${club.slug}: first snapshot (${lines.length} lines)`);
  }
  writeFileSync(snap, lines.join("\n"));
}

writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
console.log(changed ? `Updated ${changed} link(s) in data/clubs.json.` : "Social links already up to date.");
