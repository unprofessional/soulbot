-- TODO: use this to store member nicks?
-- CREATE TABLE IF NOT EXISTS user (
--     id SERIAL PRIMARY KEY,
--     username VARCHAR(50) NOT NULL UNIQUE,
--     password_hash TEXT NOT NULL,
--     created_at TIMESTAMP DEFAULT NOW()
-- );

--TODO: create table for guilds/servers and consider feature toggle on per server basis

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
CREATE INDEX IF NOT EXISTS idx_message_user_id ON message (user_id);
CREATE INDEX IF NOT EXISTS idx_message_guild_id ON message (guild_id);
CREATE INDEX idx_message_content_trgm ON message USING GIN (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_message_guild_created ON message (guild_id, created_at DESC);
