-- +goose Up
ALTER TABLE life_profiles
  ADD COLUMN IF NOT EXISTS last_evening_plan   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_morning_plan   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_evening_review TIMESTAMPTZ;

-- +goose Down
ALTER TABLE life_profiles
  DROP COLUMN IF EXISTS last_evening_plan,
  DROP COLUMN IF EXISTS last_morning_plan,
  DROP COLUMN IF EXISTS last_evening_review;
