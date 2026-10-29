import {random, hasher} from './crypto.mjs';
export const fail = (message,status=400) => {throw Object.assign(Error(message),{status})};
const clean=(s,max=80)=>{if(typeof s!=='string'||!s.trim()||s.length>max)fail('invalid-input');return s.trim()};
const days=n=>{if(![0,7,30,90].includes(n))fail('invalid-duration');return n};
const limit=n=>{if(!Number.isInteger(n)||n<1||n>20)fail('invalid-device-limit');return n};
const newKey=()=>`TN-${random(20).toUpperCase().match(/.{1,8}/g).join('-')}`;
const hint=k=>k.slice(0,11)+'…'+k.slice(-4);
const publicLicense=l=>({id:l.id,label:l.label,keyHint:l.hint,created:l.created,activated:l.activated,expires:l.expires,durationDays:l.duration,maxDevices:l.max_devices,revoked:!!l.revoked,expired:l.expires!==null&&l.expires<=Date.now()});
const valid=l=>{if(!l)fail('invalid-key');if(l.revoked)fail('revoked');if(l.expires!==null&&l.expires<=Date.now())fail('expired')};
export async function createStore(db,secret) {
  const hash=await hasher(secret),q=(sql,...args)=>db.prepare(sql).bind(...args);
  const log=(action,id)=>q('INSERT INTO audit(at,action,license_id,detail) VALUES(?,?,?,?)',Date.now(),action,id,'');
  async function batch(statements){try{return await db.batch(statements)}catch(e){for(const code of ['device-limit','remove-devices-first'])if(e.message.includes(code))fail(code);throw e}}
  return {
    async create({label,durationDays=30,maxDevices=1}) {
      label=clean(label);days(durationDays);limit(maxDevices);
      const key=newKey(),id=crypto.randomUUID(),now=Date.now();
      const results=await batch([q('INSERT INTO licenses(id,key_hash,hint,label,duration,max_devices,created) VALUES(?,?,?,?,?,?,?) RETURNING *',id,await hash(key),hint(key),label,durationDays,maxDevices,now),log('created',id)]);
      return {key,...publicLicense(results[0].results[0])};
    },
    async list() {
      const [ls,ds,au]=await batch([q('SELECT * FROM licenses ORDER BY created DESC'),q('SELECT id,license_id,label,platform,created,last_seen AS lastSeen FROM devices'),q('SELECT * FROM audit ORDER BY id DESC LIMIT 100')]);
      const grouped=new Map();for(const d of ds.results){const id=d.license_id;delete d.license_id;if(!grouped.has(id))grouped.set(id,[]);grouped.get(id).push({...d,online:Date.now()-d.lastSeen<45000})}
      return {licenses:ls.results.map(l=>({...publicLicense(l),devices:grouped.get(l.id)||[]})),audit:au.results,serverTime:Date.now()};
    },
    async change(id,{action,durationDays,maxDevices,deviceId}) {
      if(!await q('SELECT id FROM licenses WHERE id=?',id).first())fail('not-found',404);
      const stmts=[];let key;
      if(action==='revoke'){stmts.push(q('UPDATE licenses SET revoked=1 WHERE id=?',id),q('DELETE FROM devices WHERE license_id=?',id))}
      else if(action==='enable')stmts.push(q('UPDATE licenses SET revoked=0 WHERE id=?',id));
      else if(action==='extend'){days(durationDays);const now=Date.now();stmts.push(q('UPDATE licenses SET duration=?,expires=CASE WHEN ?=0 THEN NULL ELSE MAX(?,COALESCE(expires,?))+? END,activated=COALESCE(activated,?) WHERE id=?',durationDays,durationDays,now,now,durationDays*86400000,now,id))}
      else if(action==='devices')stmts.push(q('UPDATE licenses SET max_devices=? WHERE id=?',limit(maxDevices),id));
      else if(action==='reset')stmts.push(q('DELETE FROM devices WHERE license_id=?',id));
      else if(action==='remove-device')stmts.push(q('DELETE FROM devices WHERE license_id=? AND id=?',id,clean(deviceId)));
      else if(action==='rotate'){key=newKey();stmts.push(q('UPDATE licenses SET key_hash=?,hint=? WHERE id=?',await hash(key),hint(key),id),q('DELETE FROM devices WHERE license_id=?',id))}
      else if(action==='delete')stmts.push(q('DELETE FROM licenses WHERE id=?',id));
      else fail('invalid-action');
      await batch([...stmts,log(action,id)]);return {ok:true,...(key?{key}:{})};
    },
    async activate({key,deviceId,label,platform}) {
      const kh=await hash(clean(key,100).toUpperCase()),dh=await hash(clean(deviceId,100));label=clean(label);platform=clean(platform,20);
      const l=await q('SELECT * FROM licenses WHERE key_hash=?',kh).first();valid(l);
      const now=Date.now(),token=random(),th=await hash(token);
      // A batch rolls back the first activation date when the device limit rejects the insert.
      // Recheck key/revocation in SQL so a concurrent rotation cannot revive an old key.
      const result=await batch([
        q('UPDATE licenses SET activated=?,expires=CASE WHEN duration=0 THEN NULL ELSE ?+duration*86400000 END WHERE key_hash=? AND activated IS NULL AND revoked=0',now,now,kh),
        q(`INSERT INTO devices(id,license_id,device_hash,label,platform,token_hash,created,last_seen)
          SELECT ?,id,?,?,?,?,?,? FROM licenses WHERE key_hash=? AND revoked=0 AND (expires IS NULL OR expires>?)
          ON CONFLICT(license_id,device_hash) DO UPDATE SET token_hash=excluded.token_hash,label=excluded.label,platform=excluded.platform,last_seen=excluded.last_seen RETURNING id`,crypto.randomUUID(),dh,label,platform,th,now,now,kh,now),
        q('INSERT INTO audit(at,action,license_id,detail) SELECT ?,?,license_id,? FROM devices WHERE token_hash=?',now,'activated','',th),
        q('SELECT l.* FROM licenses l JOIN devices d ON d.license_id=l.id WHERE d.token_hash=?',th)
      ]);
      if(!result[1].results.length)fail('invalid-key');
      return {token,license:publicLicense(result[3].results[0]),serverTime:now};
    },
    async heartbeat(token,deviceId) {
      const th=await hash(clean(token,100)),dh=await hash(clean(deviceId,100)),now=Date.now();
      const result=await batch([
        q('UPDATE devices SET last_seen=? WHERE token_hash=? AND device_hash=? AND EXISTS(SELECT 1 FROM licenses WHERE id=devices.license_id AND revoked=0 AND (expires IS NULL OR expires>?))',now,th,dh,now),
        q('SELECT l.* FROM licenses l JOIN devices d ON d.license_id=l.id WHERE d.token_hash=? AND d.device_hash=?',th,dh)
      ]);
      const l=result[1].results[0];if(!l)fail('activation-required');valid(l);
      return {license:publicLicense(l),serverTime:now};
    },
    async deactivate(token,deviceId){await q('DELETE FROM devices WHERE token_hash=? AND device_hash=?',await hash(clean(token,100)),await hash(clean(deviceId,100))).run();return {ok:true}}
  };
}
