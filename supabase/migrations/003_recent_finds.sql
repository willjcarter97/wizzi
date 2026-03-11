-- Recent recipe finds — caches AI search results to avoid repeat API calls.
-- Stores the full MealFinderResult JSON so the detail view renders instantly.

create table if not exists recent_finds (
  id uuid primary key default uuid_generate_v4(),
  recipe_name text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

-- Keep only the latest entry per recipe name
create unique index recent_finds_recipe_name_idx on recent_finds (recipe_name);

-- For ordering by most recent
create index recent_finds_created_at_idx on recent_finds (created_at desc);

-- Household-wide access (same pattern as other tables)
alter table recent_finds enable row level security;

create policy "household_all" on recent_finds for all using (true) with check (true);
