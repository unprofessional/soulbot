CREATE TABLE IF NOT EXISTS counting_game (
    id BIGSERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
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
-- Channel remains the team/game identity. Roles are reusable eligibility filters.
CREATE TABLE IF NOT EXISTS counting_allowed_role (
    game_id BIGINT NOT NULL REFERENCES counting_game(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL,
    PRIMARY KEY (game_id, role_id)
);
CREATE INDEX IF NOT EXISTS counting_allowed_role_lookup ON counting_allowed_role(role_id, game_id);
DROP INDEX IF EXISTS counting_active_role;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema=current_schema() AND table_name='counting_game' AND column_name='role_id') THEN
        INSERT INTO counting_allowed_role(game_id, role_id)
            SELECT id, role_id FROM counting_game WHERE role_id IS NOT NULL
            ON CONFLICT DO NOTHING;
        ALTER TABLE counting_game DROP COLUMN role_id;
    END IF;
END $$;
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
