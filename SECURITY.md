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
| Dependency audit, secret scan and CodeQL on every push and weekly | `.github/workflows/security.yml` |
| Structured security log lines (`"level":"security"`) for failed logins, throttling, CAPTCHA | `src/lib/log.ts` |

## One-time setup (cannot be done from code)

1. **Run `supabase/security.sql`** in the Supabase SQL editor. Until you do, rate limiting does nothing (it fails open and logs `rate_limit_unavailable`).
2. **Supabase → Authentication**: set minimum password length to 12, enable leaked-password protection, enable TOTP multi-factor, set a session timeout.
3. **Turnstile**: create a widget at Cloudflare, put the keys in Vercel as `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`, then redeploy.
4. **Vercel**: keep `SUPABASE_SERVICE_ROLE_KEY` as a secret (never `NEXT_PUBLIC_`); enable Firewall / Bot Protection and a spend limit.
5. **Admin**: sign in, open *My account*, and set up the authenticator app. Admin pages stay locked until you do.
6. **Backups**: enable daily backups in Supabase and test a restore once.
7. **Alerts**: in Vercel, add a log drain or alert for lines containing `"level":"security"` and a spike of `login_failed` / `rate_limited`.
8. Delete `club-accounts.csv` once passwords are handed out, and rotate any that were shared in chat or email.

## If something goes wrong

1. **Contain**: in Vercel, pause the deployment or enable "Attack Challenge Mode".
2. **Rotate**: Supabase → Settings → API → regenerate the service-role key and JWT secret if exposed; update Vercel and redeploy.
3. **Reset**: reset affected lead passwords from the Leads page; sign out all sessions from Supabase Auth.
4. **Investigate**: Supabase → `audit_log` table, Vercel logs filtered on `"level":"security"`.
5. **Tell people** whose data was exposed, and your institution's IT/security contact, promptly.
6. **Lost phone**: a user with a second authenticator can remove the old one under *My account*. The admin can clear a lead's 2FA from the Leads page (*Clear 2FA*). If the admin is locked out, remove the factor in Supabase → Authentication → Users → the admin → MFA, then enrol again. As a last resort set `ADMIN_MFA=off` temporarily.

## Habits

- Merge Dependabot PRs weekly.
- Each term, delete lead accounts that are no longer needed (and review who has Supabase/Vercel/GitHub access).
- Run `select public.purge_old_event_data(365);` (or schedule it) to drop old sign-ups.
- Before a big launch, have someone outside the team test the site.
