'use strict';
const fs=require('node:fs/promises');
const {REGIONS}=require('./account.cjs');
function createProfiles(file){
  let queue=Promise.resolve();
  const clean=value=>{if(!value||typeof value.username!=='string'||!value.username.trim()||value.username.length>100||value.username.includes('|')||!REGIONS.includes(value.region))throw Error('invalid-profile');return {username:value.username.trim(),region:value.region}};
  async function read(){try{const values=JSON.parse(await fs.readFile(file,'utf8'));if(!Array.isArray(values))throw Error('profiles');return values.slice(0,20).map(clean)}catch(error){if(error.code==='ENOENT')return [];throw error}}
  const key=p=>p.region+':'+p.username.toLocaleLowerCase();
  function change(value,remove){const run=async()=>{const p=clean(value),rows=(await read()).filter(v=>key(v)!==key(p));if(!remove)rows.unshift(p);await fs.mkdir(require('node:path').dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',JSON.stringify(rows.slice(0,20)),{mode:0o600});await fs.rename(file+'.tmp',file);return rows.slice(0,20)};const result=queue.then(run,run);queue=result.catch(()=>{});return result}
  return {list:()=>queue.then(read),save:value=>change(value,false),remove:value=>change(value,true)};
}
module.exports={createProfiles};
