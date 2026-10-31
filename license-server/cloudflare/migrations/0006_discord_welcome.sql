CREATE TABLE discord_welcome_config (
 guild_id TEXT PRIMARY KEY, channel_id TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 0,
 enabled_at INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0,
 checked_at INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0,
 last_error TEXT NOT NULL DEFAULT '', member_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE discord_welcome_events (
 guild_id TEXT NOT NULL, user_id TEXT NOT NULL, joined_at TEXT NOT NULL,
 nonce TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', created INTEGER NOT NULL,
 attempted_at INTEGER, message_id TEXT, last_error TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(guild_id,user_id,joined_at)
);
CREATE INDEX discord_welcome_pending ON discord_welcome_events(guild_id,state,created);
