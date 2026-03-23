-- +goose Up
ALTER TABLE life_profiles ADD COLUMN onboarded BOOLEAN NOT NULL DEFAULT FALSE;

-- +goose Down
ALTER TABLE life_profiles DROP COLUMN IF EXISTS onboarded;
