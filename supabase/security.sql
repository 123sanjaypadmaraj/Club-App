-- ============================================================
-- Club Hub — security hardening (run in the Supabase SQL editor AFTER schema.sql and event_ops.sql; safe to re-run)
-- Adds: rate limiting, longer ticket codes, an audit trail for admin actions, and a data-retention helper.
-- ============================================================

-- ---------- 1. Rate limiting --------------------------------------------------------------------
-- Used by the app server (service role only) to slow down password guessing, sign-up floods and ticket guessing.
create table if not exists public.rate_limits (
  key          text primary key,
  hits         int         not null,
  window_start timestamptz not null
);
alter table public.rate_limits enable row level security;       -- no policies: nobody but the service role can touch it
revoke all on public.rate_limits from anon, authenticated;

-- Returns true while the caller is under the limit, false once they exceed `p_max` hits in `p_window_seconds`.
create or replace function public.rate_limit_hit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = public as $$
declare h int;
begin
  if p_max < 1 or p_window_seconds < 1 or p_key is null or length(p_key) > 200 then
    return false;
  end if;

  insert into public.rate_limits as r (key, hits, window_start)
  values (p_key, 1, now())
  on conflict (key) do update set
    hits         = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into h;

  -- occasional housekeeping so the table never grows without bound
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return h <= p_max;
end $$;

revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- ---------- 2. Longer, harder-to-guess ticket codes ----------------------------------------------
-- The app already generates 16-character codes; this makes database-generated ones match.
alter table public.event_registrations
  alter column ticket_code set default upper(substr(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 1, 20));

-- ---------- 3. Audit trail for sensitive admin actions --------------------------------------------
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      uuid references public.profiles(id) on delete set null,
  action     text not null,
  target     text,
  detail     jsonb
);
alter table public.audit_log enable row level security;
drop policy if exists audit_log_admin_read on public.audit_log;
create policy audit_log_admin_read on public.audit_log for select using (public.is_admin());
revoke insert, update, delete on public.audit_log from anon, authenticated;   -- written only by the service role

-- Role changes are the most dangerous edit in the system: record every one, whoever makes it.
create or replace function public.audit_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    insert into public.audit_log (actor, action, target, detail)
    values (auth.uid(), 'profile.role_changed', new.id::text, jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  return new;
end $$;
drop trigger if exists audit_profile_role on public.profiles;
create trigger audit_profile_role after update of role on public.profiles
  for each row execute function public.audit_profile_role();

drop trigger if exists audit_club_leads on public.club_leads;
create or replace function public.audit_club_leads() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (actor, action, target, detail)
  values (auth.uid(), 'club_lead.' || lower(tg_op),
          coalesce(new.user_id, old.user_id)::text,
          jsonb_build_object('club_id', coalesce(new.club_id, old.club_id)));
  return null;
end $$;
create trigger audit_club_leads after insert or delete on public.club_leads
  for each row execute function public.audit_club_leads();

-- ---------- 4. Data retention ---------------------------------------------------------------------
-- Keeps personal data only as long as it is useful. Run by hand, or schedule it (Supabase → Database → Cron):
--   select cron.schedule('purge-old-signups', '0 3 * * 0', $$ select public.purge_old_event_data(365) $$);
create or replace function public.purge_old_event_data(p_days int default 365)
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_days < 30 then raise exception 'retention must be at least 30 days'; end if;
  delete from public.event_registrations r
   using public.events e
   where e.id = r.event_id and coalesce(e.ends_at, e.starts_at) < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_old_event_data(int) from public, anon, authenticated;
grant execute on function public.purge_old_event_data(int) to service_role;

-- ---------- 5. Public sign-ups go through the app server only -------------------------------------
-- Before this, anyone holding the public anon key could insert registrations / feedback straight through the
-- Supabase API, skipping CAPTCHA, rate limits and length checks, and could pick their own ticket code.
-- Now only the app server (service role) can insert, via these functions. Run this file AFTER schema.sql
-- (re-running schema.sql re-creates the two anon insert policies; run this file again afterwards).
create or replace function public.submit_registration(
  p_event uuid, p_full_name text, p_email text, p_roll_no text, p_department text, p_year int, p_phone text, p_ticket_code text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.event_accepts_registration(p_event) then
    raise exception 'registration closed' using errcode = '42501';
  end if;
  if p_full_name is null or length(btrim(p_full_name)) = 0 or char_length(p_full_name) > 120
     or p_email is null or char_length(p_email) > 254 or p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
     or char_length(coalesce(p_roll_no, '')) > 40 or char_length(coalesce(p_department, '')) > 80
     or char_length(coalesce(p_phone, '')) > 20 or p_ticket_code !~ '^[A-Z0-9]{10,24}$' then
    raise exception 'invalid registration' using errcode = '22023';
  end if;
  insert into public.event_registrations (event_id, full_name, email, roll_no, department, year, phone, ticket_code)
  values (p_event, btrim(p_full_name), lower(p_email), p_roll_no, p_department, p_year, p_phone, p_ticket_code);
end $$;
revoke all on function public.submit_registration(uuid, text, text, text, text, int, text, text) from public, anon, authenticated;
grant execute on function public.submit_registration(uuid, text, text, text, text, int, text, text) to service_role;

create or replace function public.submit_feedback(
  p_event uuid, p_full_name text, p_email text, p_rating int, p_comment text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.event_accepts_feedback(p_event) then
    raise exception 'feedback closed' using errcode = '42501';
  end if;
  if p_rating is null or p_rating not between 1 and 5
     or p_email is null or char_length(p_email) > 254 or p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
     or char_length(coalesce(p_full_name, '')) > 120 or char_length(coalesce(p_comment, '')) > 2000 then
    raise exception 'invalid feedback' using errcode = '22023';
  end if;
  insert into public.event_feedback (event_id, full_name, email, rating, comment)
  values (p_event, p_full_name, lower(p_email), p_rating, p_comment);
end $$;
revoke all on function public.submit_feedback(uuid, text, text, int, text) from public, anon, authenticated;
grant execute on function public.submit_feedback(uuid, text, text, int, text) to service_role;

drop policy if exists registrations_insert on public.event_registrations;
drop policy if exists feedback_insert on public.event_feedback;

-- ---------- 6. Field rules enforced in the database -----------------------------------------------
-- Leads can update their own club / event rows straight through the API, skipping the app checks.
-- NOT VALID: existing rows are never blocked; every new or edited row must pass.
do $$
declare c record;
begin
  for c in select * from (values
    ('clubs',  'clubs_accent_chk',   $c$accent_color ~ '^#[0-9a-fA-F]{6}$'$c$),
    ('clubs',  'clubs_urls_chk',     $c$(logo_url is null or logo_url ~* '^https?://') and (instagram_url is null or instagram_url ~* '^https?://') and (linkedin_url is null or linkedin_url ~* '^https?://') and (whatsapp_url is null or whatsapp_url ~* '^https?://') and (website_url is null or website_url ~* '^https?://') and (join_form_url is null or join_form_url ~* '^https?://')$c$),
    ('clubs',  'clubs_email_chk',    $c$contact_email is null or (char_length(contact_email) <= 254 and contact_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')$c$),
    ('clubs',  'clubs_lengths_chk',  $c$char_length(name) <= 80 and char_length(coalesce(tagline, '')) <= 140 and char_length(coalesce(description, '')) <= 2000 and char_length(coalesce(faculty_advisor, '')) <= 120 and char_length(coalesce(meeting_schedule, '')) <= 160$c$),
    ('events', 'events_urls_chk',    $c$(registration_url is null or registration_url ~* '^https?://') and (feedback_url is null or feedback_url ~* '^https?://') and (poster_url is null or poster_url ~* '^https?://')$c$),
    ('events', 'events_lengths_chk', $c$char_length(title) <= 160 and char_length(coalesce(venue, '')) <= 160 and char_length(coalesce(description, '')) <= 4000$c$)
  ) as t(tbl, name, expr)
  loop
    execute format('alter table public.%I drop constraint if exists %I', c.tbl, c.name);
    execute format('alter table public.%I add constraint %I check (%s) not valid', c.tbl, c.name, c.expr);
  end loop;
end $$;
