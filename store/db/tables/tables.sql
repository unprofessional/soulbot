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
    content TEXT NOT NULL, -- Message content
    attachments TEXT[], -- Stores URLs of attachments as an array
    created_at TIMESTAMP DEFAULT NOW() -- Timestamp of the message
);
