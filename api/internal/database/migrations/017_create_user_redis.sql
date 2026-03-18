-- +goose Up
CREATE TABLE user_redis (
    id              TEXT        NOT NULL PRIMARY KEY,
    user_id         TEXT        NOT NULL,
    upstash_db_id   TEXT        NOT NULL UNIQUE,
    name            TEXT        NOT NULL,
    region          TEXT        NOT NULL DEFAULT 'us-east-1',
    endpoint        TEXT        NOT NULL,
    rest_token      TEXT        NOT NULL,
    read_only_token TEXT        NOT NULL DEFAULT '',
    password        TEXT        NOT NULL DEFAULT '',
    status          TEXT        NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_user_redis_user_id ON user_redis (user_id);

-- +goose Down
DROP TABLE IF EXISTS user_redis;
