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
