-- ============================================================
-- Club Hub — Supabase schema
-- Run this whole file once in: Supabase Dashboard → SQL Editor
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- enums ----------
do $$ begin
  create type user_role as enum ('super_admin', 'club_lead');
exception when duplicate_object then null; end $$;

-- ---------- profiles (one per auth user) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  role        user_role not null default 'club_lead',
  created_at  timestamptz not null default now()
);

-- Every new auth user gets a profile. Role is ALWAYS club_lead here;
-- promote the first admin manually (see README).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- clubs ----------
create table if not exists public.clubs (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  category         text not null default 'General',  -- Technical, Cultural, Sports, Social Service...
  tagline          text,
  description      text,
  logo_url         text,
  accent_color     text not null default '#4f46e5',
  contact_email    text,
  instagram_url    text,
  linkedin_url     text,
  whatsapp_url     text,
  website_url      text,
  join_form_url    text,           -- external "join the club" form
  faculty_advisor  text,
  meeting_schedule text,
  founded_year     int,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- which lead users manage which club (a lead can manage several, a club can have several)
create table if not exists public.club_leads (
  club_id  uuid not null references public.clubs(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  primary key (club_id, user_id)
);

-- ---------- members (club roster) ----------
create table if not exists public.club_members (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  full_name   text not null,
  email       text,
  roll_no     text,
  department  text,
  year        int,
  phone       text,
  position    text not null default 'Member',     -- President, Secretary, Core, Member...
  status      text not null default 'active' check (status in ('active', 'alumni', 'inactive')),
  joined_on   date not null default current_date,
  created_at  timestamptz not null default now()
);
create index if not exists club_members_club_idx on public.club_members(club_id);

-- ---------- events ----------
create table if not exists public.events (
  id                uuid primary key default gen_random_uuid(),
  club_id           uuid not null references public.clubs(id) on delete cascade,
  title             text not null,
  description       text,
  category          text not null default 'Workshop',  -- Workshop, Competition, Talk, Social, Meeting...
  venue             text,
  starts_at         timestamptz not null,
  ends_at           timestamptz,
  capacity          int check (capacity is null or capacity > 0),
  registration_url  text,          -- external registration form (e.g. Google Form)
  feedback_url      text,          -- external feedback form
  poster_url        text,
  registration_open boolean not null default true,
  status            text not null default 'published' check (status in ('draft', 'published', 'cancelled')),
  budget_allocated  numeric(10,2) not null default 0,
  budget_spent      numeric(10,2) not null default 0,
  created_at        timestamptz not null default now()
);
create index if not exists events_club_idx on public.events(club_id);
create index if not exists events_starts_idx on public.events(starts_at);

-- ---------- participants (event registrations) ----------
create table if not exists public.event_registrations (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  full_name      text not null,
  email          text not null,
  roll_no        text,
  department     text,
  year           int,
  phone          text,
  attended       boolean not null default false,
  attended_at    timestamptz,
  registered_at  timestamptz not null default now()
);
create unique index if not exists event_registrations_unique_email
  on public.event_registrations(event_id, lower(email));
create index if not exists event_registrations_event_idx on public.event_registrations(event_id);

-- ---------- feedback ----------
create table if not exists public.event_feedback (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  full_name   text,
  email       text not null,
  rating      int not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now()
);
create unique index if not exists event_feedback_unique_email
  on public.event_feedback(event_id, lower(email));
create index if not exists event_feedback_event_idx on public.event_feedback(event_id);

-- ---------- announcements ----------
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  title       text not null,
  body        text,
  pinned      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists announcements_club_idx on public.announcements(club_id);

-- ============================================================
-- Helper functions for row-level security
-- ============================================================
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'super_admin');
$$;

create or replace function public.manages_club(p_club uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from club_leads where club_id = p_club and user_id = auth.uid());
$$;

create or replace function public.manages_event(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from events e where e.id = p_event and public.manages_club(e.club_id));
$$;

-- Can a visitor still register for this event? (published, open, not full, not in the past)
create or replace function public.event_accepts_registration(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e
    where e.id = p_event
      and e.status = 'published'
      and e.registration_open
      and coalesce(e.ends_at, e.starts_at) > now()
      and (e.capacity is null
           or (select count(*) from event_registrations r where r.event_id = e.id) < e.capacity)
  );
$$;

-- Feedback only for published events that have already started
create or replace function public.event_accepts_feedback(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from events e where e.id = p_event and e.status = 'published' and e.starts_at <= now());
$$;

-- ============================================================
-- Row-level security
-- ============================================================
alter table public.profiles            enable row level security;
alter table public.clubs               enable row level security;
alter table public.club_leads          enable row level security;
alter table public.club_members        enable row level security;
alter table public.events              enable row level security;
alter table public.event_registrations enable row level security;
alter table public.event_feedback      enable row level security;
alter table public.announcements       enable row level security;

-- profiles: see your own; admin sees all. (Role changes only via SQL / service role.)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin());

-- clubs: public read; admin full write; leads can edit their own club
drop policy if exists clubs_select on public.clubs;
create policy clubs_select on public.clubs for select using (true);
drop policy if exists clubs_admin_all on public.clubs;
create policy clubs_admin_all on public.clubs for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists clubs_lead_update on public.clubs;
create policy clubs_lead_update on public.clubs for update
  using (public.manages_club(id)) with check (public.manages_club(id));


-- Club leads may edit descriptive fields only; slug / category / active flag are admin-only
create or replace function public.guard_club_admin_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and auth.uid() is not null then
    new.slug := old.slug;
    new.category := old.category;
    new.is_active := old.is_active;
  end if;
  return new;
end $$;
drop trigger if exists clubs_guard on public.clubs;
create trigger clubs_guard before update on public.clubs
  for each row execute function public.guard_club_admin_fields();

-- club_leads: admin manages; a lead can see own rows
drop policy if exists club_leads_select on public.club_leads;
create policy club_leads_select on public.club_leads for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists club_leads_admin_write on public.club_leads;
create policy club_leads_admin_write on public.club_leads for all
  using (public.is_admin()) with check (public.is_admin());

-- members: only people who manage the club
drop policy if exists members_all on public.club_members;
create policy members_all on public.club_members for all
  using (public.manages_club(club_id)) with check (public.manages_club(club_id));

-- events: published ones are public; managers see everything of theirs
drop policy if exists events_select on public.events;
create policy events_select on public.events for select
  using (status = 'published' or public.manages_club(club_id));
drop policy if exists events_write on public.events;
create policy events_write on public.events for all
  using (public.manages_club(club_id)) with check (public.manages_club(club_id));

-- registrations: ANYONE may register (guarded by the function); only managers can read/modify
drop policy if exists registrations_insert on public.event_registrations;
create policy registrations_insert on public.event_registrations for insert
  with check (public.event_accepts_registration(event_id));
drop policy if exists registrations_manage on public.event_registrations;
create policy registrations_manage on public.event_registrations for all
  using (public.manages_event(event_id)) with check (public.manages_event(event_id));

-- feedback: ANYONE may submit once their event has started; only managers can read
drop policy if exists feedback_insert on public.event_feedback;
create policy feedback_insert on public.event_feedback for insert
  with check (public.event_accepts_feedback(event_id));
drop policy if exists feedback_manage on public.event_feedback;
create policy feedback_manage on public.event_feedback for all
  using (public.manages_event(event_id)) with check (public.manages_event(event_id));

-- announcements: public read; managers write
drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements for select using (true);
drop policy if exists announcements_write on public.announcements;
create policy announcements_write on public.announcements for all
  using (public.manages_club(club_id)) with check (public.manages_club(club_id));

-- ============================================================
-- Analytics views
-- ============================================================

-- Per-event metrics (respects RLS → leads only see their own clubs, admin sees all)
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
  from public.event_registrations where event_id = e.id
) r on true
left join lateral (
  select count(*)::int as feedback_count, round(avg(rating)::numeric, 2) as avg_rating
  from public.event_feedback where event_id = e.id
) f on true
where e.status <> 'draft' or public.manages_club(e.club_id);

-- Per-club rollup (admin overview)
create or replace view public.club_summary with (security_invoker = true) as
select
  c.id as club_id,
  c.slug,
  c.name,
  c.category,
  c.is_active,
  (select count(*)::int from public.club_members m where m.club_id = c.id and m.status = 'active') as active_members,
  (select count(*)::int from public.events e where e.club_id = c.id and e.status = 'published') as total_events
from public.clubs c;

-- Public-safe counters (so visitors can see "23 / 60 spots taken" without reading participant rows).
-- Security-definer on purpose: it only exposes counts.
create or replace view public.event_public_counts as
select event_id, count(*)::int as registrations
from public.event_registrations
group by event_id;
grant select on public.event_public_counts to anon, authenticated;
grant select on public.event_stats, public.club_summary to authenticated;
