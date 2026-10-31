CREATE TABLE discord_links(license_id TEXT PRIMARY KEY REFERENCES licenses(id) ON DELETE CASCADE,guild_id TEXT NOT NULL,user_id TEXT NOT NULL,created INTEGER NOT NULL);
CREATE INDEX discord_user_licenses ON discord_links(guild_id,user_id);
CREATE TABLE discord_members(guild_id TEXT NOT NULL,user_id TEXT NOT NULL,checked_at INTEGER NOT NULL DEFAULT 0,last_error TEXT NOT NULL DEFAULT '',PRIMARY KEY(guild_id,user_id));
CREATE INDEX discord_member_check ON discord_members(guild_id,checked_at);
CREATE TABLE discord_requests(id TEXT PRIMARY KEY,created INTEGER NOT NULL,state TEXT NOT NULL DEFAULT 'pending');
