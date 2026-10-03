const escapeText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

/** Fold to 75 octets per line (RFC 5545), continuing with a leading space; never splits a UTF-8 character. */
export function foldLine(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > (out.length === 0 ? 75 : 74)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export type IcsEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  venue: string | null;
  description: string | null;
  url: string;
};

function veventLines(e: IcsEvent, now: Date): string[] {
  const start = new Date(e.starts_at);
  const end = e.ends_at ? new Date(e.ends_at) : new Date(start.getTime() + 3600_000);
  const desc = [e.description, e.url].filter(Boolean).join("\n\n");
  return [
    "BEGIN:VEVENT",
    `UID:${e.id}`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(start)}`,
    `DTEND:${utc(end)}`,
    `SUMMARY:${escapeText(e.title)}`,
    ...(e.venue ? [`LOCATION:${escapeText(e.venue)}`] : []),
    `DESCRIPTION:${escapeText(desc)}`,
    `URL:${e.url}`,
    "END:VEVENT",
  ];
}

const HEAD = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Club Hub//Events//EN", "CALSCALE:GREGORIAN"];

const serialize = (lines: string[]) => lines.map(foldLine).join("\r\n") + "\r\n";

export function eventToIcs(e: IcsEvent, now: Date = new Date()): string {
  return serialize([...HEAD, ...veventLines(e, now), "END:VCALENDAR"]);
}

/** One VCALENDAR with many VEVENTs, for subscribing to a club's feed. */
export function eventsToIcs(events: IcsEvent[], calName: string, now: Date = new Date()): string {
  return serialize([
    ...HEAD,
    `X-WR-CALNAME:${escapeText(calName)}`,
    ...events.flatMap((e) => veventLines(e, now)),
    "END:VCALENDAR",
  ]);
}
