-- 20 starter clubs. Rename / delete / add your own later from the admin dashboard.
insert into public.clubs (slug, name, category, tagline, description, accent_color, founded_year, meeting_schedule) values
('coding-club',      'Coding Club',            'Technical', 'Build. Break. Ship.',              'Weekly DSA practice, hackathons and open-source sprints.', '#4f46e5', 2015, 'Fridays 5 PM'),
('robotics-club',    'Robotics Club',          'Technical', 'Machines that think.',             'Arduino, ROS and competition robots.',                     '#0891b2', 2016, 'Wednesdays 4 PM'),
('ai-ml-club',       'AI & ML Club',           'Technical', 'Learn from data.',                 'Reading groups, Kaggle teams and ML workshops.',           '#7c3aed', 2019, 'Thursdays 5 PM'),
('cybersec-club',    'Cyber Security Club',    'Technical', 'Hack responsibly.',               'CTFs, security talks and bug-bounty basics.',              '#dc2626', 2018, 'Tuesdays 5 PM'),
('electronics-club', 'Electronics Club',       'Technical', 'Circuits to products.',            'PCB design, IoT builds and embedded workshops.',           '#ea580c', 2014, 'Mondays 4 PM'),
('gdsc-club',        'Developer Student Club', 'Technical', 'Community-led tech learning.',    'Study jams and Google-tech workshops.',                    '#2563eb', 2020, 'Saturdays 11 AM'),
('drama-club',       'Drama Club',             'Cultural',  'All the college is a stage.',      'Street plays, stage productions and improv nights.',       '#be185d', 2010, 'Tuesdays 6 PM'),
('music-club',       'Music Club',             'Cultural',  'Where voices and strings meet.',   'Bands, solo nights and annual fest performances.',         '#c026d3', 2009, 'Wednesdays 6 PM'),
('dance-club',       'Dance Club',             'Cultural',  'Move together.',                   'Classical, western and fusion crews.',                     '#e11d48', 2011, 'Thursdays 6 PM'),
('literary-club',    'Literary Club',          'Cultural',  'Words matter.',                    'Debates, MUNs, poetry slams and quizzes.',                 '#9333ea', 2008, 'Mondays 5 PM'),
('photography-club', 'Photography Club',       'Arts',      'See differently.',                 'Photo walks, editing workshops and exhibitions.',          '#0d9488', 2012, 'Saturdays 8 AM'),
('film-club',        'Film & Media Club',      'Arts',      'Lights, camera, college.',         'Short films, screenings and editing labs.',                '#b45309', 2013, 'Fridays 6 PM'),
('art-club',         'Fine Arts Club',         'Arts',      'Make something.',                  'Painting, sketching and mural projects around campus.',    '#d97706', 2010, 'Wednesdays 3 PM'),
('sports-club',      'Sports Council',         'Sports',    'Play hard.',                       'Inter-department tournaments and fitness drives.',         '#16a34a', 2005, 'Daily 6 AM'),
('chess-club',       'Chess Club',             'Sports',    'Think three moves ahead.',         'Weekly blitz, rated tournaments and coaching.',            '#475569', 2017, 'Tuesdays 4 PM'),
('nss-club',         'NSS / Social Service',   'Social',    'Not me, but you.',                 'Blood drives, village camps and cleanliness drives.',      '#65a30d', 2006, 'Sundays 9 AM'),
('eco-club',         'Eco Club',               'Social',    'Greener campus.',                  'Tree plantation, waste audits and sustainability talks.',  '#059669', 2016, 'Saturdays 10 AM'),
('entrepreneur-cell','E-Cell',                 'Business',  'Start something.',                 'Startup talks, pitch events and mentorship.',              '#f59e0b', 2014, 'Thursdays 4 PM'),
('finance-club',     'Finance & Markets Club', 'Business',  'Money, explained.',                'Stock simulations, finance workshops and case contests.',  '#0ea5e9', 2018, 'Mondays 3 PM'),
('quiz-club',        'Quiz Club',              'Cultural',  'Know it all?',                     'Weekly trivia and inter-college quizzes.',                 '#8b5cf6', 2012, 'Fridays 4 PM')
on conflict (slug) do nothing;
