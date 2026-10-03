# Club Hub

One app for all co-curricular clubs: public club directory, event registration, feedback, participant tracking, and an admin dashboard comparing every club's performance over time. Next.js 16 + Supabase, built for Vercel.

## Roles

| Who | Can do |
|---|---|
| **Visitor (students)** | Browse clubs/events, register for events, leave feedback — no account needed |
| **Club lead** | Manage *their* club(s): events, participants + check-in, members, announcements, settings, CSV exports, own metrics |
| **Club admin** (`super_admin`) | Everything, across all ~20 clubs: leaderboard, month-by-month heatmap, trends over 3/6/12 months/all time, create clubs, create lead accounts |

Participant data (names, emails, phones) is protected by Postgres row-level security: only the club's leads and the admin can read it, even if someone calls the Supabase API directly.

## Setup

### 1. Supabase
1. Create a project at supabase.com.
2. **SQL Editor** → run `supabase/schema.sql`, then `supabase/event_ops.sql` (waitlist, QR tickets, race-safe capacity), then `supabase/seed_real_clubs.sql` (the 15 real NHCE clubs with logos, links and descriptions; replaces the old generic starter clubs).
   Optional simulation: `supabase/seed_real_demo.sql` adds each club's real events (where its website lists any), its real student-council roster, announcements, and simulated sign-ups / attendance / feedback so the dashboards have data. Safe to re-run. `supabase/seed_big_event.sql` adds one 180-person event for trying the check-in console.
   Both seed files are generated: edit `data/clubs.json`, run `node scripts/build-seed.mjs`. To pull fresh content from the club websites, run `node scripts/scrape-clubs.mjs` first (refreshes social links and reports new text on each page).
3. **Authentication → Providers → Email**: turn **off** "Allow new users to sign up" (the admin creates lead accounts).
4. **Create the admin account**: Authentication → Users → *Add user* (email + password, tick auto-confirm). Then in the SQL editor:
   ```sql
   update public.profiles set role = 'super_admin' where email = 'YOUR-ADMIN-EMAIL';
   ```

### 1b. Club accounts
After the admin account exists and `.env.local` has your Supabase keys, create one lead login per club:
```bash
node --env-file=.env.local scripts/create-club-accounts.mjs --domain=yourcollege.edu
```
Each lead gets `<club>@yourcollege.edu` (e.g. `stem@`, `techforge@`, `cseh@`, `mad@`) with a random password, assigned to their club. Credentials are written to `club-accounts.csv` (git-ignored) — hand each lead theirs; they can change it under *Account*. Re-running keeps existing accounts; `--reset` issues new passwords.

### 2. Local run
```bash
cp .env.example .env.local     # fill in the 3 values from Supabase → Project Settings → API
npm install
npm run dev                    # http://localhost:3000
```

### 3. Deploy to Vercel
1. Push this folder to a GitHub repo, then **Add New → Project** on Vercel and import it.
2. Add the same three environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
3. Deploy. In Supabase → Authentication → URL Configuration, set the Site URL to your Vercel URL.

> `SUPABASE_SERVICE_ROLE_KEY` bypasses all security. Keep it server-side only (never `NEXT_PUBLIC_`). It's used in exactly one place: the admin creating lead accounts.

## Day to day
- **Admin**: *Club leads* → create an account per club lead and tick their club(s). Share the email + temporary password. If a lead forgets it, use *Reset password* on their card.
- **Lead**: *My club* → Events → *New event*. Paste a Google Form link in "External registration form" / "External feedback form", or leave blank and use the built-in forms. Share the event's public page link (`/events/<id>`). On the event, check people in and download participants as CSV.
- **Metrics** (per event → club → all clubs): events, registrations, attendance rate (past events only), average rating (weighted by responses), members, budget spent, turnout per event, trend vs. the earlier half of the period.

## Notes
- All times are entered and shown in IST.
- Built-in registration prevents duplicate emails per event and respects capacity / "registration open".
- Built-in feedback opens when the event starts; one response per email per event.
- Metrics count only *published* events; cancelled and draft events are excluded.

## Running an event (100–200+ people)
- **Registration** gives every attendee a QR ticket page (`/ticket/<code>`). When seats run out, sign-ups go on a **waitlist** and are promoted automatically when someone is removed or capacity is raised. Seat counting is serialised in Postgres, so a flood of simultaneous sign-ups can't oversell.
- **Import** an existing Google Forms CSV from the event page (columns matched by header).
- **Check-in console** (`/dashboard/clubs/<club>/events/<id>/checkin`): live counter, instant search across name / roll no / phone / email / ticket code, one-tap check-in with undo, **QR scanning** with the phone camera, walk-ins without an email, and auto-sync every 8 s so several volunteers can work in parallel. Pressing Enter checks in a lone search match.
- **Participants table**: filter by status / department / year, sort, paginate, bulk mark present / not arrived / promote / remove, copy emails, export the filtered list.
- **Print**: attendance sheet (paper backup) and name badges with QR codes.
- **Insights**: seats filled, registrations per day, arrivals per 15 minutes, department and year breakdown.
