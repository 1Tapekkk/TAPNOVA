CREATE TABLE licenses(id TEXT PRIMARY KEY,key_hash TEXT UNIQUE NOT NULL,hint TEXT NOT NULL,label TEXT NOT NULL,duration INTEGER NOT NULL CHECK(duration IN(0,7,30,90)),max_devices INTEGER NOT NULL CHECK(max_devices BETWEEN 1 AND 20),created INTEGER NOT NULL,activated INTEGER,expires INTEGER,revoked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE devices(id TEXT PRIMARY KEY,license_id TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,device_hash TEXT NOT NULL,label TEXT NOT NULL,platform TEXT NOT NULL,token_hash TEXT UNIQUE NOT NULL,created INTEGER NOT NULL,last_seen INTEGER NOT NULL,UNIQUE(license_id,device_hash));
CREATE TABLE audit(id INTEGER PRIMARY KEY,at INTEGER NOT NULL,action TEXT NOT NULL,license_id TEXT,detail TEXT);
CREATE INDEX license_devices ON devices(license_id);
CREATE TABLE admin_sessions(token_hash TEXT PRIMARY KEY,expires INTEGER NOT NULL,auth_version TEXT NOT NULL);
CREATE INDEX session_expiry ON admin_sessions(expires);
-- Enforce the limit inside the write transaction, including concurrent activations.
CREATE TRIGGER enforce_device_limit BEFORE INSERT ON devices
WHEN NOT EXISTS(SELECT 1 FROM devices WHERE license_id=NEW.license_id AND device_hash=NEW.device_hash)
AND (SELECT count(*) FROM devices WHERE license_id=NEW.license_id)>=(SELECT max_devices FROM licenses WHERE id=NEW.license_id)
BEGIN SELECT RAISE(ABORT,'device-limit'); END;
CREATE TRIGGER enforce_lower_limit BEFORE UPDATE OF max_devices ON licenses
WHEN NEW.max_devices<(SELECT count(*) FROM devices WHERE license_id=NEW.id)
BEGIN SELECT RAISE(ABORT,'remove-devices-first'); END;
