'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'Publish-Release.cjs'),'utf8');
const version=require('../package.json').version,sha='a'.repeat(40);
function run({missing=false,existing=null,failUpload=false}={}) {
  const calls=[],written=[];
  const exit=Symbol('exit');
  let error;
  const fakeFS={existsSync:file=>!(missing&&file.endsWith('mac-arm64.dmg')),statSync:()=>({size:2*1024*1024}),copyFileSync:()=>{},readFileSync:()=>Buffer.from('fixture'),writeFileSync:(file,body)=>written.push({file,body})};
  const fakeProcess={argv:[],env:{GITHUB_SHA:sha},exit:()=>{throw exit}};
  const fakeChild={spawnSync:(_cmd,args)=>{
    calls.push(args);
    if(args[1]==='list')return {status:0,stdout:JSON.stringify(existing?[{tagName:`v${version}`,isDraft:existing==='draft'}]:[])};
    if(args[1]==='view')return {status:0,stdout:JSON.stringify({targetCommitish:sha})};
    if(args[1]==='upload'&&failUpload)return {status:1,stderr:'upload failed'};
    return {status:0,stdout:''};
  }};
  try { vm.runInNewContext(source,{__dirname,require:name=>name==='node:fs'?fakeFS:name==='node:child_process'?fakeChild:name==='../package.json'?{version}:require(name),process:fakeProcess,console:{log(){}}}); }
  catch(e){if(e!==exit)error=e}
  return {calls,written,error};
}
let r=run({missing:true});assert.match(r.error.message,/Missing or incomplete/);assert.equal(r.calls.length,0,'Incomplete platform set cannot contact GitHub');
r=run({failUpload:true});assert.match(r.error.message,/upload failed/);assert.ok(!r.calls.some(x=>x[1]==='edit'),'Failed upload leaves a draft');
r=run({existing:'published'});assert.equal(r.error,undefined);assert.deepEqual(r.calls.map(x=>x[1]),['list'],'Published files are immutable');
r=run({existing:'draft'});assert.equal(r.error,undefined);assert.deepEqual(r.calls.map(x=>x[1]),['list','view','upload','edit']);
r=run();assert.equal(r.error,undefined);assert.deepEqual(r.calls.map(x=>x[1]),['list','create','upload','edit']);
const create=r.calls.find(x=>x[1]==='create');assert.ok(create.includes('--draft'));assert.ok(create.includes(sha));assert.ok(create.includes('--notes-file'));
const upload=r.calls.find(x=>x[1]==='upload');assert.equal(upload.filter(x=>/\.(exe|dmg|zip|md|txt)$/.test(x)).length,7);
assert.equal(r.written[0].body.trim().split('\n').length,6,'Checksums cover all installers and instructions');
console.log('PASS: complete-platform release requirement, draft/upload/publish order, upload failure, immutable published versions and checksums.');
