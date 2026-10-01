-- OPTIONAL: fake events / participants / feedback so dashboards have something to show.
-- Run AFTER seed_clubs.sql. Safe to delete later:  delete from public.events where title like '[demo]%';
do $$
declare
  c record;
  ev_id uuid;
  n_events int;
  n_regs int;
  i int;
  j int;
  ev_start timestamptz;
  club_pop numeric;
  depts text[] := array['CSE','ECE','EEE','MECH','CIVIL','IT','AI&DS'];
  cats  text[] := array['Workshop','Competition','Talk','Social','Meeting'];
begin
  for c in select id, name from public.clubs loop
    club_pop := 0.4 + random() * 1.2;                         -- each club has its own "popularity"
    n_events := 6 + floor(random() * 10);
    for i in 1..n_events loop
      ev_start := now() - (random() * 360 || ' days')::interval + (random() * 20 || ' days')::interval;
      insert into public.events (club_id, title, description, category, venue, starts_at, ends_at, capacity,
                                 budget_allocated, budget_spent, registration_open)
      values (c.id, '[demo] ' || c.name || ' event ' || i, 'Sample event generated for demo purposes.',
              cats[1 + floor(random() * 5)], 'Seminar Hall ' || (1 + floor(random() * 3)),
              ev_start, ev_start + interval '2 hours', 60 + floor(random() * 90)::int,
              2000 + floor(random() * 8000), 1500 + floor(random() * 7000), true)
      returning id into ev_id;

      n_regs := floor((15 + random() * 70) * club_pop);
      for j in 1..n_regs loop
        insert into public.event_registrations (event_id, full_name, email, roll_no, department, year, phone,
                                                 attended, registered_at)
        values (ev_id, 'Student ' || j, 'student' || (floor(random()*400))::int || '.' || j || '@college.edu',
                '22' || lpad((floor(random()*900))::int::text, 3, '0'),
                depts[1 + floor(random() * 7)], 1 + floor(random() * 4)::int,
                '98' || lpad((floor(random()*99999999))::bigint::text, 8, '0'),
                ev_start < now() and random() < 0.7,
                least(ev_start - interval '1 day', now()))
        on conflict do nothing;
      end loop;

      if ev_start < now() then
        insert into public.event_feedback (event_id, full_name, email, rating, comment)
        select ev_id, r.full_name, r.email, greatest(1, least(5, round(3 + random() * 2.2 + (club_pop - 1))::int)),
               (array['Great session!', 'Very useful.', 'Could be better organised.', 'Loved it.', 'More such events please.'])[1 + floor(random()*5)::int]
        from public.event_registrations r
        where r.event_id = ev_id and r.attended and random() < 0.55;
      end if;
    end loop;

    -- members
    for j in 1..(15 + floor(random() * 40)::int) loop
      insert into public.club_members (club_id, full_name, email, roll_no, department, year, position, joined_on)
      values (c.id, 'Member ' || j, 'member' || j || '.' || substr(c.id::text, 1, 4) || '@college.edu',
              '21' || lpad((floor(random()*900))::int::text, 3, '0'), depts[1 + floor(random() * 7)],
              1 + floor(random() * 4)::int,
              case when j = 1 then 'President' when j = 2 then 'Secretary' when j <= 6 then 'Core' else 'Member' end,
              current_date - (random() * 700)::int);
    end loop;

    insert into public.announcements (club_id, title, body, pinned)
    values (c.id, 'Welcome to ' || c.name, 'New members are welcome — watch this space for upcoming events.', true);
  end loop;
end $$;
