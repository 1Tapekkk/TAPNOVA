const enc=new TextEncoder();
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const bytes=s=>Uint8Array.from(s.match(/../g)||[],v=>parseInt(v,16));
export const randomHex=(length=32)=>hex(crypto.getRandomValues(new Uint8Array(length)));
export const digest=async value=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value))));
export const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
export async function cipher(secret){
 const key=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode('tapnova-admin-v1:'+secret)),'AES-GCM',false,['encrypt','decrypt']);
 return {seal:async value=>{const iv=crypto.getRandomValues(new Uint8Array(12));return hex(iv)+'.'+hex(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(value)))))},open:async value=>{const [iv,data]=value.split('.');return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv)},key,bytes(data))))}};
}
export function base32(value){let bits=0,buffer=0,out='';for(const b of value){buffer=(buffer<<8)|b;bits+=8;while(bits>=5){bits-=5;out+='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[(buffer>>>bits)&31]}}if(bits)out+='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[(buffer<<(5-bits))&31];return out}
export function decode32(value){let bits=0,buffer=0,out=[];for(const c of value){const n='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c);if(n<0)throw Error('base32');buffer=(buffer<<5)|n;bits+=5;if(bits>=8){bits-=8;out.push((buffer>>>bits)&255)}}return new Uint8Array(out)}
export async function totp(secret,step,digits=6){const counter=new Uint8Array(8);new DataView(counter.buffer).setBigUint64(0,BigInt(step));const key=await crypto.subtle.importKey('raw',decode32(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,counter)),offset=mac[mac.length-1]&15;const n=new DataView(mac.buffer).getUint32(offset)&0x7fffffff;return String(n%10**digits).padStart(digits,'0')}
async function stepFor(secret,code,now){if(!/^\d{6}$/.test(code||''))return -1;const step=Math.floor(now/30000);for(const i of [0,-1,1])if(await totp(secret,step+i)===code)return step+i;return -1}
export async function securityService(db,secret,now=()=>Date.now()){
 const crypt=await cipher(secret),q=(sql,...args)=>db.prepare(sql).bind(...args),state=()=>q('SELECT * FROM admin_security WHERE id=1').first();
 const log=action=>q('INSERT INTO audit(at,action,detail) VALUES(?,?,?)',now(),action,'');
 async function verify(code){const s=await state();if(!s.secret)return true;const step=await stepFor(await crypt.open(s.secret),code,now());if(step>=0){const r=await q('UPDATE admin_security SET last_step=? WHERE id=1 AND version=? AND last_step<?',step,s.version,step).run();return r.meta.changes===1}if(typeof code==='string'&&/^[a-f0-9]{24}$/i.test(code)){const r=await q('DELETE FROM admin_recovery WHERE hash=?',await digest(secret+':recovery:'+code.toLowerCase())).run();return r.meta.changes===1}return false}
 return {
  state,
  verify,
  async begin(owner){const s=await state();if(s.secret)fail('2fa-enabled');const token=base32(crypto.getRandomValues(new Uint8Array(20)));await q('UPDATE admin_security SET pending=?,pending_until=?,pending_owner=? WHERE id=1 AND secret IS NULL',await crypt.seal(token),now()+600000,owner).run();return {secret:token,expires:now()+600000}},
  async enable(owner,code){const s=await state();if(s.secret||!s.pending||s.pending_until<now()||s.pending_owner!==owner)fail('2fa-setup-expired');const step=await stepFor(await crypt.open(s.pending),code,now());if(step<0)fail('2fa-code');const recovery=Array.from({length:8},()=>randomHex(12));
   // Every statement belongs to the same enrollment and version; concurrent setup cannot replace it.
   const statements=[q('UPDATE admin_security SET secret=pending,pending=NULL,pending_owner=NULL,pending_until=0,version=version+1,last_step=? WHERE id=1 AND pending=? AND pending_owner=? AND pending_until>? AND secret IS NULL AND version=?',step,s.pending,owner,now(),s.version),...await Promise.all(recovery.map(async code=>q('INSERT INTO admin_recovery(hash) SELECT ? FROM admin_security WHERE id=1 AND secret=? AND version=?',await digest(secret+':recovery:'+code),s.pending,s.version+1))),q('INSERT INTO audit(at,action,detail) SELECT ?,?,? FROM admin_security WHERE id=1 AND secret=? AND version=?',now(),'2fa-enabled','',s.pending,s.version+1)];
   let result;try{result=await db.batch([q('INSERT INTO admin_enrollments(id) VALUES(?)',await digest(s.pending)),...statements])}catch(e){if(String(e.message).includes('UNIQUE'))fail('2fa-setup-expired');throw e}if(result[1].meta.changes!==1)fail('2fa-setup-expired');return {ok:true,recovery};
  },
  async disable(code){const s=await state();if(!s.secret||!await verify(code))fail('2fa-code');const result=await db.batch([q('UPDATE admin_security SET secret=NULL,pending=NULL,pending_owner=NULL,version=version+1,last_step=-1 WHERE id=1 AND version=? AND secret=?',s.version,s.secret),q('DELETE FROM admin_recovery WHERE EXISTS(SELECT 1 FROM admin_security WHERE id=1 AND secret IS NULL AND version=?)',s.version+1),q('INSERT INTO audit(at,action,detail) SELECT ?,?,? FROM admin_security WHERE id=1 AND secret IS NULL AND version=?',now(),'2fa-disabled','',s.version+1)]);if(result[0].meta.changes!==1)fail('2fa-code');return {ok:true}}
 };
}
