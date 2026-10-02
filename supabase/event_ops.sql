-- ============================================================
-- Club Hub — event operations (run AFTER schema.sql; safe to re-run)
-- Adds: waitlist, QR ticket codes, race-safe capacity, public ticket lookup.
-- ============================================================

alter table public.event_registrations
  add column if not exists status        text not null default 'confirmed',
  add column if not exists ticket_code   text,
  add column if not exists checked_in_by uuid references public.profiles(id) on delete set null;

do $$ begin
  alter table public.event_registrations
    add constraint event_registrations_status_chk check (status in ('confirmed', 'waitlisted'));
exception when duplicate_object then null; end $$;

-- Ticket code: short, unguessable, shown as a QR on the attendee's ticket page.
update public.event_registrations
   set ticket_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
 where ticket_code is null;
alter table public.event_registrations
  alter column ticket_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  alter column ticket_code set not null;
create unique index if not exists event_registrations_ticket_code on public.event_registrations(ticket_code);
create index if not exists event_registrations_status_idx on public.event_registrations(event_id, status);

-- Registration only checks "published / open / not over" now; a full event waitlists instead of rejecting.
create or replace function public.event_accepts_registration(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e
    where e.id = p_event
      and e.status = 'published'
      and e.registration_open
      and coalesce(e.ends_at, e.starts_at) > now()
  );
$$;

-- Promote the oldest waitlisted people while seats are free. Returns how many were promoted.
create or replace function public.promote_waitlist(p_event uuid) returns int
language plpgsql security definer set search_path = public as $$
declare cap int; taken int; free int; moved int := 0;
begin
  select capacity into cap from events where id = p_event;
  if cap is null then
    update event_registrations set status = 'confirmed' where event_id = p_event and status = 'waitlisted';
    get diagnostics moved = row_count;
    return moved;
  end if;
  select count(*) into taken from event_registrations where event_id = p_event and status = 'confirmed';
  free := cap - taken;
  if free > 0 then
    update event_registrations set status = 'confirmed'
     where id in (select id from event_registrations where event_id = p_event and status = 'waitlisted'
                  order by registered_at limit free);
    get diagnostics moved = row_count;
  end if;
  return moved;
end $$;
revoke all on function public.promote_waitlist(uuid) from public, anon;
grant execute on function public.promote_waitlist(uuid) to authenticated;

-- Before insert: serialise per event so 200 people registering at once can't oversell seats,
-- decide confirmed vs waitlisted, and stop public visitors from self-marking attendance.
create or replace function public.registrations_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare cap int; taken int;
begin
  perform pg_advisory_xact_lock(hashtext(new.event_id::text));
  if public.manages_event(new.event_id) then
    return new;                        -- organisers may add walk-ins / over-capacity guests
  end if;
  new.attended := false;
  new.attended_at := null;
  new.checked_in_by := null;
  select capacity into cap from events where id = new.event_id;
  select count(*) into taken from event_registrations where event_id = new.event_id and status = 'confirmed';
  new.status := case when cap is not null and taken >= cap then 'waitlisted' else 'confirmed' end;
  return new;
end $$;
drop trigger if exists registrations_before_insert on public.event_registrations;
create trigger registrations_before_insert before insert on public.event_registrations
  for each row execute function public.registrations_before_insert();

-- When a confirmed seat frees up, move the next waitlisted person in.
create or replace function public.registrations_after_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'confirmed' then perform public.promote_waitlist(old.event_id); end if;
  return old;
end $$;
drop trigger if exists registrations_after_delete on public.event_registrations;
create trigger registrations_after_delete after delete on public.event_registrations
  for each row execute function public.registrations_after_delete();

-- When capacity is raised, fill the new seats from the waitlist.
create or replace function public.events_after_capacity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.promote_waitlist(new.id);
  return new;
end $$;
drop trigger if exists events_after_capacity on public.events;
create trigger events_after_capacity after update of capacity on public.events
  for each row when (new.capacity is distinct from old.capacity)
  execute function public.events_after_capacity();

-- Public ticket page: look up ONE registration by its secret code (no table access needed).
create or replace function public.ticket_lookup(p_code text)
returns table (
  full_name text, status text, attended boolean, ticket_code text, waitlist_position int,
  event_id uuid, title text, starts_at timestamptz, ends_at timestamptz, venue text,
  club_name text, club_slug text, accent_color text, event_status text
)
language sql stable security definer set search_path = public as $$
  select r.full_name, r.status, r.attended, r.ticket_code,
         case when r.status = 'waitlisted' then
           (select count(*)::int from event_registrations w
             where w.event_id = r.event_id and w.status = 'waitlisted' and w.registered_at <= r.registered_at)
         end,
         e.id, e.title, e.starts_at, e.ends_at, e.venue, c.name, c.slug, c.accent_color, e.status
    from event_registrations r
    join events e on e.id = r.event_id
    join clubs c on c.id = e.club_id
   where r.ticket_code = upper(trim(p_code))
   limit 1;
$$;
grant execute on function public.ticket_lookup(text) to anon, authenticated;

-- Counters: only confirmed seats count as "registered"; waitlist is reported separately.
create or replace view public.event_public_counts as
select event_id,
       (count(*) filter (where status = 'confirmed'))::int  as registrations,
       (count(*) filter (where status = 'waitlisted'))::int as waitlisted
from public.event_registrations
group by event_id;
grant select on public.event_public_counts to anon, authenticated;

create or replace view public.event_stats with (security_invoker = true) as
select
  e.id                                   as event_id,
  e.club_id,
  e.title,
  e.category,
  e.status,
  e.starts_at,
  e.capacity,
  e.budget_allocated,
  e.budget_spent,
  coalesce(r.registrations, 0)           as registrations,
  coalesce(r.attendees, 0)               as attendees,
  coalesce(f.feedback_count, 0)          as feedback_count,
  f.avg_rating
from public.events e
left join lateral (
  select count(*)::int as registrations, count(*) filter (where attended)::int as attendees
  from public.event_registrations where event_id = e.id and status = 'confirmed'
) r on true
left join lateral (
  select count(*)::int as feedback_count, round(avg(rating)::numeric, 2) as avg_rating
  from public.event_feedback where event_id = e.id
) f on true
where e.status <> 'draft' or public.manages_club(e.club_id);
grant select on public.event_stats to authenticated;
