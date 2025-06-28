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
-- RPG TRACKER: FLEXIBLE CHARACTER SYSTEM (REFACTORED, REORDERED + CLEANED)
-- -- -- -- -- --

-- === GAME METADATA ===
CREATE TABLE game (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- === GAME-DEFINED STAT FIELD TEMPLATES ===
CREATE TABLE stat_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES game(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'short' CHECK (field_type IN ('short', 'paragraph')),
  default_value TEXT,
  is_required BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  meta JSONB DEFAULT '{}'
);

-- === CHARACTERS ===
CREATE TABLE character (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES game(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Discord user ID
  name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'link-only')),
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- === PLAYER ACCOUNTS (GLOBAL IDENTITY) ===
CREATE TABLE player (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- === PLAYER SERVER CONTEXT (PER-GUILD CONFIG) ===
CREATE TABLE player_server_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,

  role TEXT DEFAULT 'player' CHECK (role IN ('player', 'gm')),
  current_character_id UUID REFERENCES character(id) ON DELETE SET NULL,
  current_game_id UUID REFERENCES game(id) ON DELETE SET NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(player_id, guild_id)
);

-- === TEMPLATE-BASED STAT FIELDS ===
CREATE TABLE character_stat_field (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES character(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES stat_template(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  meta JSONB DEFAULT '{}',
  UNIQUE(character_id, template_id)
);

-- === PLAYER-DEFINED CUSTOM FIELDS ===
CREATE TABLE character_custom_field (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES character(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  meta JSONB DEFAULT '{}',
  UNIQUE(character_id, name)
);

-- === INVENTORY ITEMS ===
CREATE TABLE character_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES character(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,
  equipped BOOLEAN DEFAULT FALSE,
  description TEXT
);

-- === INVENTORY ITEM FIELDS ===
CREATE TABLE character_inventory_field (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES character_inventory(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  meta JSONB DEFAULT '{}',
  UNIQUE(inventory_id, name)
);

-- === DISCORD USER INTERACTION TRACKER FOR BETTER UI / UX ===
CREATE TABLE player_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id TEXT NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL,
    interaction_type TEXT DEFAULT 'game_stat_template',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (player_id, game_id, interaction_type)
);

-- === INDEXES ===
-- Game + Guild lookup
CREATE INDEX idx_game_guild_id ON game(guild_id);

-- Character lookups
CREATE INDEX idx_character_user_id ON character(user_id);
CREATE INDEX idx_character_game_id ON character(game_id);

-- Stat lookups
CREATE INDEX idx_stat_character_id ON character_stat_field(character_id);
CREATE INDEX idx_stat_template_game_id ON stat_template(game_id);

-- Custom field lookup
CREATE INDEX idx_custom_stat_character_id ON character_custom_field(character_id);

-- Inventory lookups
CREATE INDEX idx_inventory_character_id ON character_inventory(character_id);
CREATE INDEX idx_inventory_field_inventory_id ON character_inventory_field(inventory_id);

-- Player-server context lookups
CREATE INDEX idx_player_server_link_player_id ON player_server_link(player_id);
CREATE INDEX idx_player_server_link_guild_id ON player_server_link(guild_id);
CREATE INDEX idx_player_server_link_player_guild ON player_server_link(player_id, guild_id);
