-- Add origin and country_flag columns to recipes table
alter table recipes add column if not exists origin text;
alter table recipes add column if not exists country_flag text;
