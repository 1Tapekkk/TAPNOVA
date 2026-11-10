'use strict';
// Isolated fixture for dashboard tests and local design preview. Never uses production data.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),net=require('node:net');
const {createServer}=require('../license-server/server.cjs');
async function createFixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tapnova-dashboard-'));
 const password=crypto.randomBytes(24).toString('hex'),salt=crypto.randomBytes(16).toString('hex');
 const config={secret:crypto.randomBytes(32).toString('hex'),salt,passwordHash:crypto.scryptSync(password,salt,64).toString('hex')};
 const reserve=net.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
 const origin='http://127.0.0.1:'+port;const {server,store}=createServer({config,dataDir:dir,origin,secure:false});
 const names=['LunaSky','Maja Rose','Oliwia Moon','Kacper Night','Julia Star','Nadia Violet','Alex Nova','Wiktoria Blue','Zosia Pearl','Natalia Glow','Amelia Sun','Tomek Wolf','Laura Pink','Adam Cloud','Emilia Dream','Hania Bloom','Łukasz Żółć','Julia <img src=x onerror=alert(1)>','Sofia Light','Mila Frost'];
 const now=Date.now(),day=86400000,ids=[];
 names.forEach((label,i)=>{const license=store.create({label,durationDays:i%7===0?0:i%3===0?90:30,maxDevices:i%4===0?2:1});ids.push(license.id);const created=now-(i+1)*day;store.db.prepare('UPDATE licenses SET created=? WHERE id=?').run(created,license.id);store.db.prepare('UPDATE audit SET at=? WHERE license_id=?').run(created,license.id);if(i%5!==3){store.activate({key:license.key,deviceId:'fixture-'+i,label:i%2?'MacBook Air':'Komputer Windows',platform:i%2?'darwin':'win32'});const activated=now-(i%13)*day;store.db.prepare('UPDATE licenses SET activated=?,expires=? WHERE id=?').run(activated,i%7===0?null:now+(i%6===0?-1:i%4===0?3:20+i)*day,license.id);store.db.prepare("UPDATE audit SET at=? WHERE license_id=? AND action='activated'").run(activated,license.id);store.db.prepare('UPDATE devices SET last_seen=? WHERE license_id=?').run(i<4?now:now-i*3600000,license.id)}if(i===9||i===14)store.change(license.id,{action:'revoke'});});
 await new Promise(r=>server.listen(port,'127.0.0.1',r));
 return {server,store,origin,password,ids,async close(){await new Promise(r=>server.close(r));if(path.dirname(dir)!==os.tmpdir()||!path.basename(dir).startsWith('tapnova-dashboard-'))throw Error('Unexpected fixture directory');fs.rmSync(dir,{recursive:true,force:true})}};
}
module.exports={createFixture};
