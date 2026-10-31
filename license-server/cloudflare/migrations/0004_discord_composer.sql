CREATE TABLE discord_drafts (
 id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, owner_id TEXT NOT NULL,
 channel_id TEXT NOT NULL, message_id TEXT,
 data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
 state TEXT NOT NULL DEFAULT 'draft', created INTEGER NOT NULL, expires INTEGER NOT NULL,
 result_id TEXT
);
CREATE INDEX discord_draft_expiry ON discord_drafts(expires);
CREATE UNIQUE INDEX discord_one_message_editor ON discord_drafts(guild_id,channel_id,message_id)
 WHERE message_id IS NOT NULL AND state IN ('draft','publishing');
