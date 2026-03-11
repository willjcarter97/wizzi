-- ─── Enable extensions ───────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Pantry items ─────────────────────────────────────────────────────────────
create table pantry_items (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  brand         text,
  barcode       text,
  location      text not null check (location in ('fridge','freezer','cupboard','spice_rack')),
  quantity      numeric not null default 1,
  max_quantity  numeric not null default 1,
  unit          text not null default 'units',
  -- fullness is a computed column: quantity / max_quantity clamped 0–1
  fullness      numeric generated always as (
                  least(1, greatest(0, quantity / nullif(max_quantity, 0)))
                ) stored,
  category      text not null default 'other',
  expiry_date   date,
  image_url     text,
  notes         text,
  low_stock_threshold numeric not null default 0.2,
  added_at      timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Automatically update updated_at on any row change
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pantry_items_updated_at
  before update on pantry_items
  for each row execute function update_updated_at();

-- ─── Usage logs ───────────────────────────────────────────────────────────────
create table usage_logs (
  id                uuid primary key default uuid_generate_v4(),
  pantry_item_id    uuid references pantry_items(id) on delete set null,
  pantry_item_name  text not null,
  action            text not null check (action in ('cooked','threw_out','used')),
  quantity_change   numeric not null,  -- negative = used/removed
  reason            text,
  recipe_id         uuid,              -- nullable FK added after recipes table
  logged_at         timestamptz not null default now(),
  logged_by         text not null default 'household'
);

-- ─── Recipes ──────────────────────────────────────────────────────────────────
create table recipes (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  description         text,
  meal_type           text not null check (meal_type in ('snack','quick','proper','batch')),
  prep_time_minutes   integer not null default 0,
  cook_time_minutes   integer not null default 0,
  servings            integer not null default 2,
  -- ingredients stored as JSONB array of RecipeIngredient objects
  ingredients         jsonb not null default '[]',
  -- instructions stored as JSONB array of strings
  instructions        jsonb not null default '[]',
  tags                text[] not null default '{}',
  image_url           text,
  source_url          text,
  ai_generated        boolean not null default false,
  saved_at            timestamptz not null default now(),
  last_cooked         timestamptz,
  cook_count          integer not null default 0
);

-- Add the FK from usage_logs to recipes now that recipes table exists
alter table usage_logs
  add constraint usage_logs_recipe_id_fkey
  foreign key (recipe_id) references recipes(id) on delete set null;

-- ─── Daily plans ──────────────────────────────────────────────────────────────
-- Stores the AI-generated daily meal plan as JSONB.
-- One row per day; regenerated on demand or by a scheduled function.
create table daily_plans (
  id            uuid primary key default uuid_generate_v4(),
  date          date not null unique,
  breakfast     jsonb not null default '[]',  -- array of RecipeSuggestion
  snack         jsonb not null default '[]',
  lunch         jsonb not null default '[]',
  dinner        jsonb not null default '[]',
  generated_at  timestamptz not null default now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index pantry_items_location_idx on pantry_items(location);
create index pantry_items_expiry_idx   on pantry_items(expiry_date) where expiry_date is not null;
create index pantry_items_barcode_idx  on pantry_items(barcode)     where barcode is not null;
create index usage_logs_item_idx       on usage_logs(pantry_item_id);
create index usage_logs_action_idx     on usage_logs(action);
create index usage_logs_logged_at_idx  on usage_logs(logged_at desc);
create index daily_plans_date_idx      on daily_plans(date desc);

-- ─── Row Level Security (basic – single household) ────────────────────────────
-- For a two-person household app, RLS is simple: everyone authenticated can read/write.
-- Extend this if you add multi-household support later.
alter table pantry_items enable row level security;
alter table usage_logs    enable row level security;
alter table recipes       enable row level security;
alter table daily_plans   enable row level security;

create policy "household_all" on pantry_items for all using (true) with check (true);
create policy "household_all" on usage_logs    for all using (true) with check (true);
create policy "household_all" on recipes       for all using (true) with check (true);
create policy "household_all" on daily_plans   for all using (true) with check (true);
