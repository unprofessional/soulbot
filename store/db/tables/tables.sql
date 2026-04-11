-- -- -- -- -- --
-- DISCORD MESSSAGE ARCHIVER
-- -- -- -- -- --

-- TODO: use this to store member nicks?
-- CREATE TABLE IF NOT EXISTS user (
--     id SERIAL PRIMARY KEY,
--     username VARCHAR(50) NOT NULL UNIQUE,
--     password_hash TEXT NOT NULL,
--     created_at TIMESTAMP DEFAULT NOW()
-- );

CREATE TABLE IF NOT EXISTS guild (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(50) NOT NULL UNIQUE,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE guild
ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS channel (
    id SERIAL PRIMARY KEY,
    channel_id VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS member (
    id SERIAL PRIMARY KEY,
    member_id VARCHAR(50) NOT NULL UNIQUE,
    prefix VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ollama_member_whitelist (
    id SERIAL PRIMARY KEY,
    member_id VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50), -- user/member/account owner of message
    guild_id VARCHAR(50), -- Stores the guild ID; nullable for direct messages
    channel_id VARCHAR(50), -- Stores the channel ID; nullable for direct messages
    message_id VARCHAR(50), -- Stores the message ID;
    content TEXT NOT NULL, -- Message content
    attachments TEXT[], -- Stores URLs of attachments as an array
    meta JSONB, -- Catch-all for other misc: username, server_name, channel_name, thread_id, 
    created_at TIMESTAMP DEFAULT NOW() -- Timestamp of the message
);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_guild_guild_id ON guild (guild_id);
CREATE INDEX IF NOT EXISTS idx_channel_channel_id ON channel (channel_id);
CREATE INDEX IF NOT EXISTS idx_member_member_id ON member (member_id);
CREATE INDEX IF NOT EXISTS idx_feature_type ON feature (type);
CREATE INDEX IF NOT EXISTS idx_ollama_member_whitelist_member_id ON ollama_member_whitelist (member_id);
CREATE INDEX IF NOT EXISTS idx_message_user_id ON message (user_id);
CREATE INDEX IF NOT EXISTS idx_message_guild_id ON message (guild_id);
CREATE INDEX IF NOT EXISTS idx_message_content_trgm ON message USING GIN (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_message_guild_created ON message (guild_id, created_at DESC);

INSERT INTO feature (type, enabled)
VALUES ('twitter', TRUE)
ON CONFLICT (type) DO NOTHING;
