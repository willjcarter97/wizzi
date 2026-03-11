-- Update meal_type constraint on recipes table
-- Old values: breakfast, snack, lunch, dinner (time-of-day slots)
-- New values: snack, quick, proper, batch (recipe categories)

alter table recipes drop constraint if exists recipes_meal_type_check;
alter table recipes add constraint recipes_meal_type_check
  check (meal_type in ('snack', 'quick', 'proper', 'batch'));

-- Migrate any existing rows with old values
update recipes set meal_type = 'quick' where meal_type = 'breakfast';
update recipes set meal_type = 'proper' where meal_type = 'lunch';
update recipes set meal_type = 'proper' where meal_type = 'dinner';
-- 'snack' stays as 'snack'
