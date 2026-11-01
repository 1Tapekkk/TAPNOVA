const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
const bits=(...n)=>n.reduce((value,bit)=>value|(1n<<BigInt(bit)),0n);
export const rolePlans={
 Moderator:{permissions:bits(7,13,34,40).toString(),color:0xe67e22,hoist:true},
 Support:{permissions:'0',color:0x3498db,hoist:true},
 Tester:{permissions:'0',color:0x9b59b6,hoist:true},
 Powiadomienia:{permissions:'0',color:0xf1c40f,hoist:false}
};
async function api(env,path,method='GET',data){
 const r=await fetch('https://discord.com/api/v10'+path,{method,headers:{authorization:`Bot ${env.DISCORD_BOT_TOKEN}`,'content-type':'application/json','user-agent':'DiscordBot (https://github.com/1Tapekkk/TAPNOVA, 1.0)',...(method!=='GET'?{'x-audit-log-reason':'TAPNOVA owner-requested server roles and community access'}:{})},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(8000)});
 if(!r.ok)fail('discord-http-'+r.status,502);
 return r.status===204?null:r.json();
}
export async function serverSnapshot(env){
 const base=`/guilds/${env.DISCORD_GUILD_ID}`;
 const [roles,channels,bot]=await Promise.all([api(env,base+'/roles'),api(env,base+'/channels'),api(env,base+'/members/'+env.DISCORD_APPLICATION_ID)]);
 return {roles,channels:channels.map(({id,name,type,parent_id,permission_overwrites})=>({id,name,type,parent_id,permission_overwrites})),bot:{id:env.DISCORD_APPLICATION_ID,roles:bot.roles}};
}
export function mergeAccess(overwrite,allow){
 return {type:0,allow:(BigInt(overwrite?.allow||'0')|allow).toString(),deny:(BigInt(overwrite?.deny||'0')&~allow).toString()};
}
export async function configureServer(env,data){
 const snapshot=await serverSnapshot(env),base=`/guilds/${env.DISCORD_GUILD_ID}`;
 if(data.action==='staff-order'){
  for(const name of ['Support','Moderator']){
   const roles=await api(env,base+'/roles'),role=roles.find(r=>r.name===name&&!r.managed);
   const top=Math.max(0,...roles.filter(r=>snapshot.bot.roles.includes(r.id)).map(r=>r.position));
   if(!role||top<2||role.position>=top)fail('staff-order-unavailable');
   await api(env,base+'/roles','PATCH',[{id:role.id,position:top-1}]);
  }
  return {roles:await api(env,base+'/roles')};
 }
 if(data.action==='role'&&Object.hasOwn(rolePlans,data.name)){
  const found=snapshot.roles.filter(r=>r.name===data.name);
  if(found.length>1)fail('duplicate-role-names');
  const existing=found[0],plan=rolePlans[data.name];
  if(existing?.managed)fail('managed-role');
  const highest=Math.max(0,...snapshot.roles.filter(r=>snapshot.bot.roles.includes(r.id)).map(r=>r.position));
  if(existing&&existing.position>=highest)fail('role-above-bot');
  const payload={name:data.name,permissions:plan.permissions,colors:{primary_color:plan.color},hoist:plan.hoist,mentionable:false};
  return {role:await api(env,base+'/roles'+(existing?'/'+existing.id:''),existing?'PATCH':'POST',payload)};
 }
 if(data.action==='community'){
  const categories=snapshot.channels.filter(c=>c.type===4&&c.name.toLocaleLowerCase('pl').includes('społeczność'));
  if(categories.length!==1)fail('community-category-ambiguous');
  const category=categories[0],targets=[category,...snapshot.channels.filter(c=>c.parent_id===category.id&&[0,5].includes(c.type))];
  const roles=['Członek','Moderator','Support'].map(name=>{const matches=snapshot.roles.filter(r=>r.name===name&&!r.managed);if(matches.length!==1)fail('missing-or-duplicate-'+name);return matches[0]});
  const allow=bits(6,10,11,14,15,16,38),changed=[];
  for(const c of targets)for(const role of roles){
   const old=c.permission_overwrites?.find(o=>o.type===0&&o.id===role.id),next=mergeAccess(old,allow);
   if(old?.allow===next.allow&&old?.deny===next.deny)continue;
   await api(env,`/channels/${c.id}/permissions/${role.id}`,'PUT',next);changed.push({channel:c.id,role:role.id});
  }
  return {changed,category:category.id};
 }
 fail('invalid-server-action');
}
