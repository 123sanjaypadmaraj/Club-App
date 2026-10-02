-- One large upcoming event for trying the check-in console: 180 sign-ups for 150 seats (30 waitlisted),
-- 45 already checked in. Remove with: delete from events where title like '[demo] Flagship%';
do $$
declare
  v_club uuid; v_event uuid; i int;
  firsts text[] := array['Aarav','Diya','Vihaan','Ananya','Aditya','Isha','Rohan','Meera','Kabir','Saanvi','Arjun','Priya','Karthik','Neha','Rahul','Sneha','Siddharth','Kavya','Varun','Pooja'];
  lasts  text[] := array['Sharma','Patel','Reddy','Iyer','Nair','Gupta','Singh','Das','Menon','Rao','Kulkarni','Joshi','Mehta','Bose','Pillai'];
  depts  text[] := array['CSE','ECE','EEE','Mechanical','Civil','IT','AI & DS'];
begin
  select id into v_club from clubs order by name limit 1;
  delete from events where title = '[demo] Flagship Hackathon 2026';
  insert into events(club_id, title, description, category, venue, starts_at, ends_at, capacity, status, registration_open)
  values (v_club, '[demo] Flagship Hackathon 2026', 'A 24-hour build sprint — 150 seats, waitlist beyond that.', 'Competition',
          'Main Auditorium', now() + interval '1 hour', now() + interval '9 hours', 150, 'published', true)
  returning id into v_event;
  for i in 1..180 loop
    insert into event_registrations(event_id, full_name, email, roll_no, department, year, phone, registered_at)
    values (v_event,
            firsts[1 + (i % 20)] || ' ' || lasts[1 + ((i * 7) % 15)],
            'participant' || i || '@college.edu',
            '22' || upper(substr(depts[1 + (i % 7)], 1, 2)) || lpad(i::text, 3, '0'),
            depts[1 + (i % 7)],
            1 + (i % 4),
            '98' || lpad((10000000 + i * 7919)::text, 8, '0'),
            now() - (180 - i) * interval '25 minutes');
  end loop;
  update event_registrations
     set attended = true,
         attended_at = now() - ((rn % 5) * interval '6 minutes'),
         checked_in_by = null
   from (select id, row_number() over (order by registered_at) rn from event_registrations where event_id = v_event and status = 'confirmed') s
   where event_registrations.id = s.id and s.rn <= 45;
end $$;
