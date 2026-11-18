CREATE TABLE IF NOT EXISTS counting_game (
    id BIGSERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active','paused','suspended','retired')),
    mistake_policy TEXT NOT NULL DEFAULT 'reject' CHECK (mistake_policy IN ('reject','reset')),
    allow_consecutive BOOLEAN NOT NULL DEFAULT FALSE,
    current_count BIGINT NOT NULL DEFAULT 0 CHECK (current_count BETWEEN 0 AND 9007199254740991),
    record BIGINT NOT NULL DEFAULT 0,
    history_id BIGINT NOT NULL DEFAULT 1,
    run_id BIGINT NOT NULL DEFAULT 1,
    version BIGINT NOT NULL DEFAULT 1,
    last_author_id TEXT,
    last_message_id TEXT,
    UNIQUE (guild_id, channel_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS counting_active_role ON counting_game (guild_id, role_id) WHERE state <> 'retired';
CREATE TABLE IF NOT EXISTS counting_event (
    id BIGSERIAL PRIMARY KEY,
    game_id BIGINT NOT NULL REFERENCES counting_game(id),
    history_id BIGINT NOT NULL,
    run_id BIGINT NOT NULL,
    version BIGINT NOT NULL,
    kind TEXT NOT NULL,
    author_id TEXT,
    message_id TEXT UNIQUE,
    number BIGINT,
    detail JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS counting_event_game ON counting_event(game_id, history_id, run_id);
