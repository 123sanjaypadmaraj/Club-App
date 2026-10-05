# Club Hub security

## What is built in

| Protection | Where |
| --- | --- |
| Per-club data isolation (row-level security on every table) | `supabase/schema.sql`, `event_ops.sql` |
| Rate limiting: login (per IP and per username), registration, feedback, ticket lookup, password change, 2FA codes | `src/lib/ratelimit.ts`, `supabase/security.sql` |
| CAPTCHA (Cloudflare Turnstile) on login, registration, feedback | `src/lib/turnstile.ts`, `src/components/Turnstile.tsx` |
| Two-step login (authenticator app). Required for the admin; the proxy blocks `/dashboard` until it is completed | `src/proxy.ts`, `src/lib/auth.ts`, `src/app/login/mfa` |
| 12-character password minimum, common/identity-based passwords rejected | `src/lib/password.ts` |
| Per-request nonce CSP on `/dashboard` and `/login` (no inline scripts without the nonce) | `src/proxy.ts`, `src/lib/csp.ts` |
| Content-Security-Policy, HSTS, no-framing, no-sniffing, `no-store` on private pages | `next.config.ts` |
| 16-character random ticket codes; ticket lookups throttled | `src/lib/tickets.ts`, `src/app/ticket/[code]/page.tsx` |
| CSV exports neutralise spreadsheet formulas | `src/lib/csv.ts` |
| Service-role key used only on the server, behind admin checks (and for rate limiting) | `src/lib/supabase/server.ts` |
| Audit trail (`audit_log`): role and club-lead changes (database triggers), plus lead create/reset/delete, password changes and 2FA enrolment (app) | `supabase/security.sql`, `src/lib/audit.ts` |
| Idle (60 min) and absolute (12 h) session timeout, configurable via `SESSION_IDLE_MINUTES` / `SESSION_MAX_HOURS` | `src/proxy.ts`, `src/lib/session.ts` |
| Fresh authenticator code (15 min) before creating/resetting/deleting leads or creating clubs; admin 2FA enforced on club pages and exports | `src/lib/auth.ts` |
| Login: per-IP limit, then CAPTCHA, then per-account limits (15 min and daily), so bots cannot lock accounts out | `src/app/login/actions.ts` |
| Changing a password signs out every other session | `src/app/dashboard/actions.ts` |
| Retention helper for old sign-ups | `supabase/security.sql` |
| Dependency audit, secret scan and CodeQL on every push and weekly; actions pinned to commit SHAs, read-only token, CODEOWNERS | `.github/workflows/`, `.github/CODEOWNERS` |
| Event response-sheet links and budgets hidden from the public API (column-level grants; the link comes from a managers-only function) | `supabase/security.sql` section 7, `src/lib/eventColumns.ts` |
| Ticket lookup callable only by the app server (rate limit cannot be skipped); public counts list published events only; no user can trigger waitlist promotion directly | `supabase/security.sql` section 8, `src/app/ticket/[code]/page.tsx` |
| Roster, announcement, budget, sheet-link and ticket-code rules enforced in the database | `supabase/security.sql` section 9 |
| Startup check also fails if a service-role key is used as the public key; logs when public sign-ups are open | `src/lib/config-check.ts` |
| Personal data kept out of logs and audit entries: a test scans every log call, and email addresses in error text are masked | `src/lib/__tests__/log-pii.test.ts`, `src/lib/log.ts` |
| Session cookies are httpOnly, secure and SameSite=lax (scripts on a page cannot read the refresh token) | `src/lib/supabase/cookies.ts` |
| Notices shown after actions are signed, so a crafted `?error=` link cannot put fake text (e.g. a fake lockout phone number) on the site | `src/lib/flash.ts` |
| CAPTCHA tokens are bound to their form (`action`) and to this site's hostname | `src/lib/turnstile.ts` |
| Leads whose password the admin set or reset must choose their own before using the dashboard; `club-accounts.csv` is written owner-only | `src/proxy.ts`, `scripts/create-club-accounts.mjs` |
| Deactivating a club hides its page, contact details, events and announcements and stops sign-ups; leads cannot rewrite a club's `created_at`/`id` | `supabase/security.sql` sections 11 and 12 |
| `.env.example` is committed and a test fails if the code reads an undocumented variable; lockfile entries must come from the npm registry with a sha512 hash; `npm audit signatures` in CI | `src/lib/__tests__/env-documented.test.ts`, `lockfile.test.ts` |
| Public sign-ups inserted only by the server (function `submit_registration` / `submit_feedback`), so CAPTCHA and rate limits cannot be bypassed via the API | `supabase/security.sql`, `src/app/actions.ts` |
| Database checks on club/event colours, URLs and lengths; colours and links also re-validated when rendered | `supabase/security.sql`, `src/lib/safe.ts` |
| Linear-time email check with a 254-character cutoff; 1 MB cap on CSV imports | `src/lib/email.ts` |
| Google Sheets import: redirects only to Google hosts, 2 MB body cap | `src/lib/sheets.ts` |
| Startup configuration check (refuses to start without Supabase keys; logs `config_insecure` for missing CAPTCHA/service key, `ADMIN_MFA=off`) | `src/instrumentation.ts`, `src/lib/config-check.ts` |
| *Sign out everywhere* button | `src/app/login/actions.ts` |
| Static test over `supabase/*.sql`: RLS on every table, pinned `search_path`, no stray grants to anon | `src/lib/__tests__/sql-security.test.ts` |
| Structured security log lines (`"level":"security"`) for failed logins, throttling, CAPTCHA | `src/lib/log.ts` |

## Personal data we keep

| Store | What | Who can read it | Kept for |
| --- | --- | --- | --- |
| `event_registrations` | name, email, roll no, department, year, phone, ticket code | Leads of that club, the admin; the holder via their ticket link | Deleted 365 days after the event (`purge_old_event_data`) |
| `event_feedback` | rating, comment, and (until purged) name and email | Leads of that club, the admin | Name and email blanked after 365 days; rating and comment stay |
| `club_members` | name, email, roll no, department, year, phone, position | Leads of that club, the admin | Until a lead removes the member |
| `profiles` | name, email, role | The person themselves, the admin | Until the account is deleted |
| `audit_log` | actor id, action, target id, counts (no names or emails) | The admin | 730 days |
| `rate_limits` | hashed IP / username keys and counters | Nobody through the app (service role only) | 1 day |
| Linked Google Sheets | Whatever the organiser collects in their own form | Anyone with the sheet link; managed in Google, outside this app | Set by the organiser |

## One-time setup (cannot be done from code)

1. **Run `supabase/security.sql`** in the Supabase SQL editor (and run it again whenever you re-run `schema.sql`). Until you do, rate limiting does nothing (it fails open and logs `rate_limit_unavailable`) and public sign-ups can still be inserted around the CAPTCHA through the Supabase API. It also adds database-level checks for colours, URLs and field lengths.
2. **Supabase → Authentication**: turn **off** "Allow new users to sign up" (Sign In / Providers; every account here is created by the admin, and open sign-ups let anyone with the public key create a login). Set minimum password length to 12, enable leaked-password protection, enable TOTP multi-factor, set a session timeout. The app logs `config_insecure` / `public_signup_enabled` at startup if sign-ups are still open.
3. **Turnstile**: create a widget at Cloudflare, put the keys in Vercel as `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`, then redeploy.
4. **Vercel**: keep `SUPABASE_SERVICE_ROLE_KEY` as a secret (never `NEXT_PUBLIC_`); enable Firewall / Bot Protection and a spend limit.
5. **Admin**: sign in, open *My account*, and set up the authenticator app. Admin pages stay locked until you do.
6. **Backups**: enable daily backups in Supabase and test a restore once.
7. **Alerts**: in Vercel, add a log drain or alert for lines containing `"level":"security"` and a spike of `login_failed` / `rate_limited`.
8. Delete `club-accounts.csv` once passwords are handed out, and rotate any that were shared in chat or email.

## If something goes wrong

1. **Contain**: in Vercel, pause the deployment or enable "Attack Challenge Mode".
2. **Rotate**: Supabase → Settings → API → regenerate the service-role key and JWT secret if exposed; update Vercel and redeploy.
3. **Reset**: reset affected lead passwords from the Leads page. Each person can end all their sessions with *Sign out everywhere* under My account (the admin should do this first).
4. **Investigate**: Supabase → `audit_log` table, Vercel logs filtered on `"level":"security"`.
5. **Tell people** whose data was exposed, and your institution's IT/security contact, promptly.
6. **Lost phone**: a user with a second authenticator can remove the old one under *My account*. The admin can clear a lead's 2FA from the Leads page (*Clear 2FA*). If the admin is locked out, remove the factor in Supabase → Authentication → Users → the admin → MFA, then enrol again. As a last resort set `ADMIN_MFA=off` temporarily.

## Habits

- On GitHub, protect `main` (Settings → Branches): require a pull request, require review from Code Owners, and require the CI and Security checks to pass.

- Merge Dependabot PRs weekly.
- Each term, delete lead accounts that are no longer needed (and review who has Supabase/Vercel/GitHub access).
- Run `select public.purge_old_event_data(365, 730);` (or schedule it, see `supabase/security.sql` section 10). It deletes old sign-ups, blanks names and emails on old feedback, and trims old audit and rate-limit rows.
- Before a big launch, have someone outside the team test the site.
