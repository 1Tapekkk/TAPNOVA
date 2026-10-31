'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../Resources/Extension/app.js'),'utf8');
const section=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)+from.length));
(async()=>{
 let calls=0,consent=false,message='',response={data:{greetings:{sendGreeting:{success:true,data:{nextGreetingSecondsRemaining:900}}}}};
 const scope={ce:{accessToken:'test-token'},k:'https://eu.mspapis.com',n:'SummerGreeting',r:type=>type==='HalloweenGreeting'?{label:'Halloween Greeting',diam:1}:null,cd:()=>{},window:{confirm:text=>{message=text;return consent}},cn:async(url,opts)=>{calls++;const body=JSON.parse(opts.body);assert.equal(body.variables.greetingType,'HalloweenGreeting');assert.equal(body.variables.ignoreDailyCap,false);assert.equal(body.variables.receiverProfileId,'target');assert.equal(url,'https://eu.mspapis.com/federationgateway/graphql');return {ok:true,json:async()=>response}},setTimeout,document:{hidden:false}};
 vm.createContext(scope);
 vm.runInContext(section('async function Ls(', 'async function __xbResolveAutoWait(')+section('async function __xbSendGreetingRetry(', 'async function __xbDetectVip(')+section('function tnConfirmGreeting(', 'async function __xbAutoRepeat('),scope);
 assert.equal(scope.tnConfirmGreeting('HalloweenGreeting',0),false);assert.equal(scope.tnConfirmGreeting('HalloweenGreeting',101),false);assert.equal(scope.tnConfirmGreeting('HalloweenGreeting',3),false);assert.match(message,/3 Diax/);consent=true;assert.equal(scope.tnConfirmGreeting('HalloweenGreeting',3),true);
 let result=await scope.__xbSendGreetingRetry('HalloweenGreeting','target');assert.equal(result.ok,true);assert.equal(result.wait,900);assert.equal(calls,1);
 response={data:{greetings:{sendGreeting:{success:false,error:{reason:'FailedDefinitionNotFound'}}}}};result=await scope.__xbSendGreetingRetry('HalloweenGreeting','target');assert.equal(result.ok,false);assert.equal(calls,2,'No repeated paid request after rejection');
 scope.cn=async()=>{calls++;throw Error('network-unknown')};await assert.rejects(()=>scope.__xbSendGreetingRetry('HalloweenGreeting','target'),/network-unknown/);assert.equal(calls,3,'No retry after ambiguous purchase outcome');
 scope.cn=async()=>({ok:false,status:429,headers:new Headers({'retry-after':'12'}),body:new ReadableStream()});
 result=await scope.Ls('HalloweenGreeting','target');assert.equal(result.status,429);assert.equal(result.wait,12);
 scope.cn=async()=>({ok:false,status:429,headers:new Headers()});
 result=await scope.Ls('HalloweenGreeting','target');assert.equal(result.wait,30);
 console.log('PASS: paid greeting cost/finite consent, exact outgoing type, daily-cap protection, server cooldown and no retry on paid failure. Live event identity is not verified by these offline tests.');
})().catch(e=>{console.error(e);process.exitCode=1});
