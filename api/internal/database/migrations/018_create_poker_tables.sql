-- +goose Up
CREATE TABLE IF NOT EXISTS poker_sessions (
    id              TEXT        NOT NULL PRIMARY KEY,
    name            TEXT        NOT NULL,
    owner_id        TEXT        NOT NULL,
    owner_token     TEXT        NOT NULL,
    scale_type      TEXT        NOT NULL DEFAULT 'fibonacci',
    scale_values    TEXT        NOT NULL DEFAULT '[]',
    status          TEXT        NOT NULL DEFAULT 'active',
    active_story_id TEXT,
    voting_open     BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_poker_sessions_owner ON poker_sessions (owner_id);

CREATE TABLE IF NOT EXISTS poker_stories (
    id          TEXT        NOT NULL PRIMARY KEY,
    session_id  TEXT        NOT NULL REFERENCES poker_sessions(id) ON DELETE CASCADE,
    title       TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    sort_order  INT         NOT NULL DEFAULT 0,
    revealed    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_poker_stories_session ON poker_stories (session_id);

CREATE TABLE IF NOT EXISTS poker_votes (
    id               TEXT        NOT NULL PRIMARY KEY,
    story_id         TEXT        NOT NULL REFERENCES poker_stories(id) ON DELETE CASCADE,
    session_id       TEXT        NOT NULL,
    participant_name TEXT        NOT NULL,
    value            TEXT        NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (story_id, participant_name)
);
CREATE INDEX IF NOT EXISTS idx_poker_votes_story ON poker_votes (story_id);

-- +goose Down
DROP TABLE IF EXISTS poker_votes;
DROP TABLE IF EXISTS poker_stories;
DROP TABLE IF EXISTS poker_sessions;
