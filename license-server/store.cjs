'use strict';
const {DatabaseSync}=require('node:sqlite');
const crypto=require('node:crypto');
const DAY=86400000;
const invalid=code=>{throw Object.assign(Error(code),{status:400})};
function createStore(file,secret,now=()=>Date.now()){
  const db=new DatabaseSync(file,{timeout:5000});
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS licenses(id TEXT PRIMARY KEY,key_hash TEXT UNIQUE NOT NULL,hint TEXT NOT NULL,label TEXT NOT NULL,duration INTEGER NOT NULL,max_devices INTEGER NOT NULL,created INTEGER NOT NULL,activated INTEGER,expires INTEGER,revoked INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY,license_id TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,device_hash TEXT NOT NULL,label TEXT NOT NULL,platform TEXT NOT NULL,token_hash TEXT UNIQUE NOT NULL,created INTEGER NOT NULL,last_seen INTEGER NOT NULL,UNIQUE(license_id,device_hash));
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,at INTEGER NOT NULL,action TEXT NOT NULL,license_id TEXT,detail TEXT);
    CREATE INDEX IF NOT EXISTS license_devices ON devices(license_id);`);
  const hash=value=>crypto.createHmac('sha256',secret).update(value).digest('hex');
  const log=(action,id,detail='')=>db.prepare('INSERT INTO audit(at,action,license_id,detail) VALUES(?,?,?,?)').run(now(),action,id,detail);
  const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}};
  const key=()=>`TN-${crypto.randomBytes(20).toString('hex').toUpperCase().match(/.{1,8}/g).join('-')}`;
  const hint=k=>k.slice(0,11)+'…'+k.slice(-4);
  const license=id=>db.prepare('SELECT * FROM licenses WHERE id=?').get(id)||invalid('not-found');
  const valid=l=>{if(l.revoked)invalid('revoked');if(l.expires!==null&&l.expires<=now())invalid('expired')};
  const clean=(s,max=80)=>{if(typeof s!=='string'||!s.trim()||s.length>max)invalid('invalid-input');return s.trim()};
  const days=d=>{if(![0,7,30,90].includes(d))invalid('invalid-duration');return d};
  const limit=n=>{if(!Number.isInteger(n)||n<1||n>20)invalid('invalid-device-limit');return n};
  const publicLicense=l=>({id:l.id,label:l.label,keyHint:l.hint,created:l.created,activated:l.activated,expires:l.expires,durationDays:l.duration,maxDevices:l.max_devices,revoked:!!l.revoked,expired:l.expires!==null&&l.expires<=now()});
  return {
    close:()=>db.close(),db,
    create({label,durationDays=30,maxDevices=1}){label=clean(label);days(durationDays);limit(maxDevices);const k=key(),id=crypto.randomUUID();transaction(()=>{db.prepare('INSERT INTO licenses(id,key_hash,hint,label,duration,max_devices,created) VALUES(?,?,?,?,?,?,?)').run(id,hash(k),hint(k),label,durationDays,maxDevices,now());log('created',id)});return {key:k,...publicLicense(license(id))}},
    list(){return db.prepare('SELECT * FROM licenses ORDER BY created DESC').all().map(l=>({...publicLicense(l),devices:db.prepare('SELECT id,label,platform,created,last_seen AS lastSeen FROM devices WHERE license_id=?').all(l.id).map(d=>({...d,online:now()-d.lastSeen<45000}))}))},
    audit(){return db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 100').all()},
    change(id,{action,durationDays,maxDevices,deviceId}){return transaction(()=>{const l=license(id);let newKey;
      if(action==='revoke'){db.prepare('UPDATE licenses SET revoked=1 WHERE id=?').run(id);db.prepare('DELETE FROM devices WHERE license_id=?').run(id)}
      else if(action==='enable')db.prepare('UPDATE licenses SET revoked=0 WHERE id=?').run(id);
      else if(action==='extend'){days(durationDays);const expires=durationDays===0?null:Math.max(now(),l.expires||now())+durationDays*DAY;db.prepare('UPDATE licenses SET duration=?,expires=?,activated=COALESCE(activated,?) WHERE id=?').run(durationDays,expires,now(),id)}
      else if(action==='devices'){limit(maxDevices);const count=db.prepare('SELECT count(*) AS n FROM devices WHERE license_id=?').get(id).n;if(count>maxDevices)invalid('remove-devices-first');db.prepare('UPDATE licenses SET max_devices=? WHERE id=?').run(maxDevices,id)}
      else if(action==='reset')db.prepare('DELETE FROM devices WHERE license_id=?').run(id);
      else if(action==='remove-device')db.prepare('DELETE FROM devices WHERE license_id=? AND id=?').run(id,clean(deviceId));
      else if(action==='rotate'){newKey=key();db.prepare('UPDATE licenses SET key_hash=?,hint=? WHERE id=?').run(hash(newKey),hint(newKey),id);db.prepare('DELETE FROM devices WHERE license_id=?').run(id)}
      else if(action==='delete')db.prepare('DELETE FROM licenses WHERE id=?').run(id);
      else invalid('invalid-action');
      log(action,id);return {ok:true,...(newKey?{key:newKey}:{})};
    })},
    activate({key:input,deviceId,label,platform}){const k=clean(input,100).toUpperCase(),device=hash(clean(deviceId,100));label=clean(label);platform=clean(platform,20);return transaction(()=>{
      let l=db.prepare('SELECT * FROM licenses WHERE key_hash=?').get(hash(k));if(!l)invalid('invalid-key');valid(l);
      const previous=db.prepare('SELECT id FROM devices WHERE license_id=? AND device_hash=?').get(l.id,device);
      if(!previous&&db.prepare('SELECT count(*) AS n FROM devices WHERE license_id=?').get(l.id).n>=l.max_devices)invalid('device-limit');
      if(l.activated===null){db.prepare('UPDATE licenses SET activated=?,expires=? WHERE id=?').run(now(),l.duration?now()+l.duration*DAY:null,l.id);l=license(l.id)}
      const token=crypto.randomBytes(32).toString('base64url');
      if(previous)db.prepare('UPDATE devices SET token_hash=?,label=?,platform=?,last_seen=? WHERE id=?').run(hash(token),label,platform,now(),previous.id);
      else db.prepare('INSERT INTO devices VALUES(?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),l.id,device,label,platform,hash(token),now(),now());
      log('activated',l.id);return {token,license:publicLicense(l),serverTime:now()};
    })},
    heartbeat(token,deviceId){const d=db.prepare('SELECT * FROM devices WHERE token_hash=? AND device_hash=?').get(hash(clean(token,100)),hash(clean(deviceId,100)));if(!d)invalid('activation-required');const l=license(d.license_id);valid(l);db.prepare('UPDATE devices SET last_seen=? WHERE id=?').run(now(),d.id);return {license:publicLicense(l),serverTime:now()}},
    deactivate(token,deviceId){db.prepare('DELETE FROM devices WHERE token_hash=? AND device_hash=?').run(hash(clean(token,100)),hash(clean(deviceId,100)));return {ok:true}}
  };
}
module.exports={createStore};
