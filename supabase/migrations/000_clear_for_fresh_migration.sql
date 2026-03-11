-- ─── Clear all app objects so you can run 001_initial_schema.sql fresh ─────────
-- Run this once in Supabase SQL Editor, then run 001_initial_schema.sql.

-- Drop tables (order: dependents first, then base tables)
drop table if exists daily_plans   cascade;
drop table if exists usage_logs    cascade;
drop table if exists recipes       cascade;
drop table if exists pantry_items  cascade;

-- Drop the trigger’s function (trigger is dropped with pantry_items)
drop function if exists update_updated_at() cascade;
