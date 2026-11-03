'use strict';
const {randomUUID}=require('node:crypto');
const REGIONS=['PL','GB','US','CA','DE','FR','TR','NL','DK','NO','SE','FI','ES','IT','AU','NZ'];
function hosts(region){const cluster=['US','CA'].includes(region)?'us':'eu';return {api:`https://${cluster}.mspapis.com`,auth:`https://${cluster}-secure.mspapis.com/loginidentity/connect/token`}}
function claims(token){try{return JSON.parse(Buffer.from(token.split('.')[1],'base64url'))}catch{throw Error('response')}}
function createAccount({fetch,notify=()=>{},changed=async()=>{},now=()=>Date.now()}={}){
  let session=null,phase='signed-out',controller=null,epoch=0,timer,nextAttempt=0;
  const device=randomUUID();
  const snapshot=()=>({phase,active:!!session,username:session?.username||'',region:session?.region||''});
  const publish=()=>notify(snapshot());
  function logout(reason='signed-out'){epoch++;controller?.abort();controller=null;clearTimeout(timer);session=null;phase=reason;publish()}
  async function request(url,options,signal){
    const response=await fetch(url,{...options,redirect:'error',credentials:'omit',signal:AbortSignal.any([signal,AbortSignal.timeout(20000)])});
    if(response.status===429){nextAttempt=now()+Math.min(300000,Math.max(30000,(Number(response.headers.get('retry-after'))||30)*1000));throw Error('rate-limit')}
    let data;try{data=await response.json()}catch{throw Error('response')}
    if(!response.ok){if(data.error==='invalid_grant')throw Error('credentials');if(response.status===403||data.error==='login_denied')throw Error('denied');throw Error('network')}
    return data;
  }
  const token=(url,fields,signal)=>request(url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:'https://moviestarplanet2.com'},body:new URLSearchParams({client_id:'unity.client',client_secret:'secret',...fields}).toString()},signal);
  function valid(value){if(typeof value!=='string'||!value||value.length>20000)throw Error('response');return value}
  function schedule(){clearTimeout(timer);if(!session)return;timer=setTimeout(refresh,Math.max(1000,Math.min(3600000,session.expires-now()-60000)));timer.unref?.()}
  async function refresh(){
    if(!session)return;const current=epoch,old=session,abort=new AbortController();controller=abort;
    try{
      const data=await token(hosts(old.region).auth,{grant_type:'refresh_token',refresh_token:old.refreshToken,acr_values:`gameId:j68d deviceId:${device} profileId:${old.profileId}`},abort.signal);
      if(current!==epoch)return;
      const accessToken=valid(data.access_token),expires=Number(claims(accessToken).exp)*1000;if(!Number.isFinite(expires)||expires<=now())throw Error('response');
      session={...old,accessToken,refreshToken:valid(data.refresh_token||old.refreshToken),expires};
      await changed(lease());if(current!==epoch)return;phase='active';publish();schedule();
    }catch{if(current===epoch){logout('expired');await changed(null)}}finally{if(controller===abort)controller=null}
  }
  function lease(){return session?{accessToken:session.accessToken,profileId:session.profileId,username:session.username,region:session.region}:null}
  async function login(input){
    if(controller)return {ok:false,error:'busy'};
    if(now()<nextAttempt)return {ok:false,error:'rate-limit'};
    const username=typeof input?.username==='string'?input.username.trim():'',password=input?.password,region=String(input?.region||'').toUpperCase();
    if(!username||username.length>100||username.includes('|')||typeof password!=='string'||!password||password.length>256||!REGIONS.includes(region))return {ok:false,error:'input'};
    logout();const current=epoch,abort=new AbortController();controller=abort;phase='signing-in';publish();nextAttempt=now()+2000;
    try{
      const {api,auth}=hosts(region),acr=`gameId:j68d deviceId:${device}`;
      const generic=await token(auth,{grant_type:'password',scope:'openid nebula offline_access',username:`${region}|${username}`,password,acr_values:acr},abort.signal);
      const access=valid(generic.access_token),sub=claims(access).sub;
      if(typeof sub!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(sub))throw Error('response');
      const profiles=await request(`${api}/profileidentity/v1/logins/${encodeURIComponent(sub)}/profiles?region=${region}&pageSize=100`,{headers:{authorization:`Bearer ${access}`,origin:'https://moviestarplanet2.com'}},abort.signal);
      const matches=Array.isArray(profiles)?profiles.filter(p=>!p.gameId||p.gameId==='j68d'):[];
      if(matches.length!==1||!/^[a-zA-Z0-9_-]{1,100}$/.test(matches[0].id||''))throw Error('profile');
      const profileId=matches[0].id;
      const scoped=await token(auth,{grant_type:'refresh_token',refresh_token:valid(generic.refresh_token),acr_values:`${acr} profileId:${profileId}`},abort.signal);
      const accessToken=valid(scoped.access_token),expires=Number(claims(accessToken).exp)*1000;
      if(!Number.isFinite(expires)||expires<=now())throw Error('response');
      if(current!==epoch)return {ok:false,error:'cancelled'};
      session={accessToken,refreshToken:valid(scoped.refresh_token),profileId,username,region,expires};phase='active';publish();schedule();return {ok:true,...snapshot()};
    }catch(error){if(current!==epoch)return {ok:false,error:'cancelled'};phase='signed-out';session=null;publish();return {ok:false,error:['credentials','denied','rate-limit','profile','response'].includes(error.message)?error.message:'network'}}
    finally{if(controller===abort)controller=null}
  }
  return {login,logout,snapshot,lease,refresh};
}
module.exports={createAccount,hosts,REGIONS};
