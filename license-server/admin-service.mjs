import {cipher,digest,randomHex,fail} from './admin-security.mjs';
export function sqliteAdapter(db){
 const prepare=sql=>({bind(...args){return {first:async()=>db.prepare(sql).get(...args)||null,all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}}),_sql:sql,_args:args}}});
 return {prepare,batch:async stmts=>{db.exec('BEGIN IMMEDIATE');try{const out=stmts.map(s=>{const stmt=db.prepare(s._sql);if(stmt.columns().length)return {results:stmt.all(...s._args)};return {meta:{changes:Number(stmt.run(...s._args).changes)}}});db.exec('COMMIT');return out}catch(e){db.exec('ROLLBACK');throw e}}};
}
export async function adminService(db,secret,hash){
 const q=(sql,...args)=>db.prepare(sql).bind(...args),crypt=await cipher(secret);
 return {
  async history(params){const action=params.get('action')||'',search=(params.get('q')||'').trim().slice(0,100),before=Number(params.get('before')||Number.MAX_SAFE_INTEGER);if(!Number.isSafeInteger(before)||before<1)fail('invalid-input');const where=`a.id<? AND (?='' OR a.action=?) AND (?='' OR instr(lower(COALESCE(l.label,'')||' '||COALESCE(a.license_id,'')||' '||COALESCE(a.detail,'')),lower(?))>0)`;const rows=(await q(`SELECT a.*,l.label FROM audit a LEFT JOIN licenses l ON l.id=a.license_id WHERE ${where} ORDER BY a.id DESC LIMIT 51`,before,action,action,search,search).all()).results;return {events:rows.slice(0,50),next:rows.length>50?rows[49].id:null}},
  async batch(data){const {requestId,label,durationDays,maxDevices,count}=data;if(!/^[a-f0-9-]{36}$/.test(requestId||'')||typeof label!=='string'||!label.trim()||label.length>70||![0,7,30,90].includes(durationDays)||!Number.isInteger(maxDevices)||maxDevices<1||maxDevices>20||!Number.isInteger(count)||count<1||count>20)fail('invalid-input');const payload=await digest(JSON.stringify({label:label.trim(),durationDays,maxDevices,count}));
   async function previous(){const row=await q('SELECT * FROM admin_batches WHERE id=?',requestId).first();if(!row)return null;if(row.payload_hash!==payload||row.expires<Date.now())fail('batch-expired');return crypt.open(row.result)}
   const old=await previous();if(old)return old;const created=Date.now(),items=await Promise.all(Array.from({length:count},async(_,i)=>{const key='TN-'+randomHex(20).toUpperCase().match(/.{1,8}/g).join('-');return {id:crypto.randomUUID(),label:label.trim()+' '+String(i+1).padStart(2,'0'),key,durationDays,maxDevices,created}}));const result={items};
   const statements=[q('INSERT INTO admin_batches(id,payload_hash,result,expires) VALUES(?,?,?,?)',requestId,payload,await crypt.seal(result),created+3600000)];for(const item of items){statements.push(q('INSERT INTO licenses(id,key_hash,hint,label,duration,max_devices,created) VALUES(?,?,?,?,?,?,?)',item.id,await hash(item.key),item.key.slice(0,11)+'…'+item.key.slice(-4),item.label,durationDays,maxDevices,created),q('INSERT INTO audit(at,action,license_id,detail) VALUES(?,?,?,?)',created,'created',item.id,'Seria: '+label.trim()))}try{await db.batch(statements)}catch(e){const other=await previous();if(other)return other;throw e}return result;
  }
 };
}
