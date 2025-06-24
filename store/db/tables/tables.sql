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

-- -- -- -- -- --
-- RPG TRACKER
-- -- -- -- -- --

-- Campaign/Game Metadata
CREATE TABLE IF NOT EXISTS game (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT, -- Optional: if linked to a Discord server
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL, -- Discord user ID of DM
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Characters per Game
CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES game(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  class TEXT,
  race TEXT,
  level INTEGER DEFAULT 1 CHECK (level > 0),
  hp INTEGER DEFAULT 10 CHECK (hp >= 0),
  max_hp INTEGER DEFAULT 10 CHECK (max_hp >= 0),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Character Stats (Normalized)
CREATE TABLE IF NOT EXISTS character_stat_field (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (name IN ('str', 'dex', 'con', 'int', 'wis', 'cha')),
  value INTEGER NOT NULL CHECK (value >= 0),
  UNIQUE(character_id, name) -- Prevent duplicate stat names for a character
);

-- User Profiles
CREATE TABLE IF NOT EXISTS user_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id TEXT NOT NULL UNIQUE, -- maps to Discord user ID
  role TEXT DEFAULT 'player' CHECK (role IN ('player', 'gm')),
  current_character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_game_guild_id ON game(guild_id);
CREATE INDEX IF NOT EXISTS idx_characters_user_id ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_game_id ON characters(game_id);
CREATE INDEX IF NOT EXISTS idx_stat_character_id ON character_stat_field(character_id);
CREATE INDEX IF NOT EXISTS idx_user_discord_id ON user_profile(discord_id);
CREATE INDEX IF NOT EXISTS idx_user_current_char_id ON user_profile(current_character_id);
