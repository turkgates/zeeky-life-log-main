-- Language tag for suggestion rows (zeeky-suggestions / client inserts)
alter table public.suggestions
  add column if not exists language text default 'tr';

create index if not exists suggestions_user_language_idx
  on public.suggestions (user_id, language);
