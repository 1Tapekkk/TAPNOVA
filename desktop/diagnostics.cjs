'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
// Structural diagnostics only: no messages, URLs, request bodies or credentials.
const kinds = new Set(['startup','main-error','unhandled-rejection','game-error','game-rejection','request-error','job-error','renderer-gone','load-failed','unresponsive','responsive','child-gone']);
const reasons = new Set(['Error','TypeError','RangeError','SyntaxError','ReferenceError','AbortError','TimeoutError','QuotaExceededError','clean-exit','abnormal-exit','killed','crashed','oom','launch-failed','integrity-failure','memory-eviction']);
function sanitize(kind, data = {}) {
  if (!kinds.has(kind)) return null;
  const row = { time:new Date().toISOString(), kind };
  if (reasons.has(data.name || data.reason)) row.reason = data.name || data.reason;
  for (const key of ['code','line','column','active','queued']) if (Number.isSafeInteger(data[key])) row[key] = data[key];
  if (['main','game','shell','GPU','Utility'].includes(data.source)) row.source = data.source;
  return row;
}
function createDiagnostics(directory) {
  const file = path.join(directory,'diagnostics.jsonl');
  let pending = [], timer, writing = Promise.resolve(), windowAt = Date.now(), accepted = 0, dropped = 0;
  function flush() {
    clearTimeout(timer); timer = null;
    const batch = pending; pending = [];
    if (!batch.length) return writing;
    writing = writing.then(async () => {
      await fs.mkdir(directory,{recursive:true});
      const size = await fs.stat(file).then(s=>s.size,()=>0);
      if (size >= 512*1024) {
        await fs.rm(file+'.1',{force:true}); await fs.rename(file,file+'.1');
      }
      await fs.appendFile(file,batch.map(row=>JSON.stringify(row)).join('\n')+'\n');
    }).catch(()=>{ dropped += batch.length; });
    return writing;
  }
  return {
    record(kind,data) {
      const row = sanitize(kind,data); if (!row) return;
      if (Date.now()-windowAt >= 60000) {windowAt=Date.now();accepted=0;}
      if (accepted >= 60 || pending.length >= 128) {dropped++;return;}
      accepted++;pending.push(row);
      if (!timer) {timer=setTimeout(flush,500);timer.unref?.();}
    },
    flush,
    async report(metadata = {}) {
      await flush();
      const events = [];
      for (const name of [file+'.1',file]) {
        const text = await fs.readFile(name,'utf8').catch(()=>'');
        for (const line of text.split('\n').filter(Boolean)) {try {const row=JSON.parse(line),clean=sanitize(row.kind,row);if(clean)events.push({...clean,time:row.time});}catch{}}
      }
      return JSON.stringify({format:'tapnova-diagnostics',version:1,...metadata,dropped,events:events.slice(-500)},null,2);
    }
  };
}
module.exports = { createDiagnostics, sanitize };
