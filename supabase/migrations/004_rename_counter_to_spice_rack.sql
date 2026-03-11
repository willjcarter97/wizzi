-- Rename "counter" location to "spice_rack"

-- Update existing rows
update pantry_items set location = 'spice_rack' where location = 'counter';

-- Drop old constraint and add new one
alter table pantry_items drop constraint if exists pantry_items_location_check;
alter table pantry_items add constraint pantry_items_location_check
  check (location in ('fridge', 'freezer', 'cupboard', 'spice_rack'));
