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
-- RPG TRACKER: FLEXIBLE CHARACTER SYSTEM
-- -- -- -- -- --

-- === GAME METADATA ===
CREATE TABLE game (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT, -- Discord server ID (optional)
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL, -- Discord user ID (usually the GM)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- === PLAYER ACCOUNTS ===
CREATE TABLE player (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id TEXT NOT NULL UNIQUE,
  role TEXT DEFAULT 'player' CHECK (role IN ('player', 'gm')),
  current_character_id UUID REFERENCES character(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- === CHARACTERS ===
CREATE TABLE character (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES game(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Discord user ID
  name TEXT NOT NULL,
  class TEXT,
  race TEXT,
  level INTEGER DEFAULT 1 CHECK (level > 0),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- === CHARACTER STATS (Flexible, per-character) ===
CREATE TABLE character_stat_field (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES character(id) ON DELETE CASCADE,
  name TEXT NOT NULL,    -- e.g., hp, vigor, gil, xp_total, etc.
  value INTEGER NOT NULL,
  meta JSONB DEFAULT '{}', -- Extra metadata (e.g. ["tagged", "temporary"], etc.)
  UNIQUE(character_id, name)
);

-- === INVENTORY ITEMS ===
CREATE TABLE character_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES character(id) ON DELETE CASCADE,
  name TEXT NOT NULL,       -- e.g., "Shotgun", "Potion"
  type TEXT,                -- e.g., weapon, armor, materia, utility
  equipped BOOLEAN DEFAULT FALSE,
  description TEXT
);

-- === INVENTORY ITEM FIELDS ===
CREATE TABLE character_inventory_field (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES character_inventory(id) ON DELETE CASCADE,
  name TEXT NOT NULL,       -- e.g., damage, range, tags, dice, etc.
  value TEXT NOT NULL,      -- store stringified values like "4d20", "fire", "bleed"
  meta JSONB DEFAULT '{}',  -- optional array metadata (e.g., { "modifiers": [1, 0, -1] })
  UNIQUE(inventory_id, name)
);

-- === INDEXES ===
CREATE INDEX idx_game_guild_id ON game(guild_id);
CREATE INDEX idx_character_user_id ON character(user_id);
CREATE INDEX idx_character_game_id ON character(game_id);
CREATE INDEX idx_stat_character_id ON character_stat_field(character_id);
CREATE INDEX idx_inventory_character_id ON character_inventory(character_id);
CREATE INDEX idx_inventory_field_inventory_id ON character_inventory_field(inventory_id);
CREATE INDEX idx_player_discord_id ON player(discord_id);
CREATE INDEX idx_player_current_character_id ON player(current_character_id);
