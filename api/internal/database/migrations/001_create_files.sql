-- +goose Up
CREATE TABLE IF NOT EXISTS files (
    id           TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT PRIMARY KEY,
    user_id      TEXT        NOT NULL,
    filename     TEXT        NOT NULL,
    original_name TEXT       NOT NULL,
    content_type TEXT        NOT NULL,
    size         BIGINT      NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_user_id ON files (user_id);

-- +goose Down
DROP TABLE IF EXISTS files;
