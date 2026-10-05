-- Run once in the Supabase SQL editor (safe to re-run).
-- Link to the Google Sheet holding an event's external form responses, shown live inside the app.
alter table public.events add column if not exists responses_sheet_url text;
