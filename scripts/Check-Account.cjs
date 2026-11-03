'use strict';
const assert=require('node:assert/strict');
const {createAccount,hosts}=require('../desktop/account.cjs');
const jwt=payload=>'header.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.fixture';
(async()=>{
  let clock=Date.now(),calls=[],changed=[],failure=null,hold=null;
  const access=jwt({sub:'identity',exp:Math.floor(clock/1000)+3600});
  const fetch=async(url,options)=>{
    calls.push({url,options});assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
    if(hold)return hold(options.signal);
    if(failure)return new Response(JSON.stringify({error:failure}),{status:failure==='rate-limit'?429:400,headers:{'retry-after':'60'}});
    if(url.includes('/profileidentity/'))return new Response(JSON.stringify([{id:'profile',gameId:'j68d'}]));
    const body=new URLSearchParams(options.body);
    assert.equal(body.get('client_id'),'unity.client');assert.equal(body.get('client_secret'),'secret');
    return new Response(JSON.stringify({access_token:access,refresh_token:'fixture-refresh'}));
  };
  const account=createAccount({fetch,now:()=>clock,changed:s=>changed.push(s)});
  try{
    assert.equal((await account.login({username:'name',password:'secret',region:'ZZ'})).error,'input');assert.equal(calls.length,0);
    const result=await account.login({username:'name',password:'secret',region:'PL'});
    assert.equal(result.ok,true);assert.equal(result.username,'name');assert.equal(result.accessToken,undefined);
    assert.equal(calls.length,3);assert.equal(new URL(calls[0].url).hostname,'eu-secure.mspapis.com');
    const body=new URLSearchParams(calls[0].options.body);assert.equal(body.get('username'),'PL|name');assert.equal(body.get('scope'),'openid nebula offline_access');
    assert.match(new URLSearchParams(calls[2].options.body).get('acr_values'),/profileId:profile/);
    assert.equal(account.lease().profileId,'profile');assert.ok(!JSON.stringify(account.snapshot()).includes('fixture-refresh'));
    await account.refresh();assert.equal(changed.length,1);assert.equal(changed[0].accessToken,access);
    account.logout();assert.equal(account.lease(),null);assert.equal(account.snapshot().active,false);
    clock+=3000;failure='invalid_grant';calls=[];assert.equal((await account.login({username:'name',password:'secret',region:'PL'})).error,'credentials');assert.equal(calls.length,1);
    clock+=3000;failure='rate-limit';assert.equal((await account.login({username:'name',password:'secret',region:'PL'})).error,'rate-limit');const n=calls.length;
    assert.equal((await account.login({username:'name',password:'secret',region:'PL'})).error,'rate-limit');assert.equal(calls.length,n);
    clock+=61000;failure=null;let started;const ready=new Promise(r=>started=r);
    hold=signal=>new Promise((resolve,reject)=>{started();signal.addEventListener('abort',()=>reject(Error('cancel')),{once:true})});
    const pending=account.login({username:'name',password:'secret',region:'PL'});await ready;account.logout();assert.equal((await pending).error,'cancelled');assert.equal(account.lease(),null);
    assert.equal(hosts('US').auth,'https://us-secure.mspapis.com/loginidentity/connect/token');
    console.log('PASS: direct account login, profile-scoped token, refresh, logout, cancellation, input validation, 429 cooldown and secret-free status.');
  }finally{account.logout()}
})().catch(e=>{console.error(e);process.exitCode=1});
