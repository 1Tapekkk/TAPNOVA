'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createDiagnostics}=require('../desktop/diagnostics.cjs');
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tapnova-diagnostics-'));
 try {
  const log=createDiagnostics(dir);
  log.record('game-error',{name:'TypeError',source:'game',line:22,message:'Bearer SECRET',url:'https://secret',key:'SECRET'});
  log.record('untrusted-secret',{name:'SECRET'});
  for(let i=0;i<500;i++)log.record('request-error',{name:'TimeoutError',queued:128});
  const raw=await log.report({appVersion:'test'}),report=JSON.parse(raw);
  assert.equal(report.events.length,60);assert.equal(report.dropped,441);assert.ok(!raw.includes('SECRET'));
  assert.equal(report.events[0].line,22);assert.equal(report.events[0].reason,'TypeError');
  await fs.writeFile(path.join(dir,'diagnostics.jsonl'),' '.repeat(512*1024));
  const next=createDiagnostics(dir);next.record('startup');await next.flush();
  assert.ok((await fs.stat(path.join(dir,'diagnostics.jsonl.1'))).size>=512*1024);
  assert.ok((await fs.stat(path.join(dir,'diagnostics.jsonl'))).size<1024);
  console.log('PASS: bounded async diagnostics, rotation, redaction by whitelist, flood control and export.');
 }finally{await fs.rm(dir,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
