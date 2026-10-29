'use strict';
// Ad-hoc macOS builds can download a verified DMG, but cannot use Squirrel.Mac
// to replace themselves. This path never bypasses Gatekeeper or rewrites .app.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {Readable,Transform}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const {RELEASES,stable}=require('./updates.cjs');
function validateManifest(doc,arch) {
  if(!stable(doc?.version)||!['arm64','x64'].includes(arch)||!Array.isArray(doc.files))throw Error('manifest');
  const name=`TAPNOVA-${doc.version}-mac-${arch}.dmg`;
  const matches=doc.files.filter(file=>file.name===name);
  const file=matches[0];
  if(matches.length!==1||!Number.isSafeInteger(file.size)||file.size<1024||file.size>2*1024**3||!/^[0-9a-f]{64}$/.test(file.sha256))throw Error('manifest');
  return {version:doc.version,name,size:file.size,sha256:file.sha256};
}
async function digest(file) {
  const hash=crypto.createHash('sha256');
  for await(const chunk of require('node:fs').createReadStream(file))hash.update(chunk);
  return hash.digest('hex');
}
function macEngine({fetch,arch,directory,openPath}) {
  let entry,downloaded,progress=()=>{};
  return {
    onProgress:callback=>{progress=callback},onError:()=>{},
    async check(){
      const response=await fetch(`${RELEASES}/latest/download/update.json`,{credentials:'omit',signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw Error('manifest-http');
      let text='';for await(const chunk of response.body){text+=Buffer.from(chunk).toString('utf8');if(text.length>65536)throw Error('manifest-size')}
      entry=validateManifest(JSON.parse(text),arch);downloaded=null;return {version:entry.version};
    },
    async download(){
      if(!entry)throw Error('no-update');
      await fs.mkdir(directory,{recursive:true});
      const target=path.join(directory,entry.name),partial=target+'.part';
      downloaded=null;
      try {
        const response=await fetch(`${RELEASES}/download/v${entry.version}/${entry.name}`,{credentials:'omit',signal:AbortSignal.timeout(30*60*1000)});
        if(!response.ok||!response.body)throw Error('download-http');
        let bytes=0;const hash=crypto.createHash('sha256');
        const meter=new Transform({transform(chunk,_encoding,callback){bytes+=chunk.length;if(bytes>entry.size)return callback(Error('download-size'));hash.update(chunk);progress(bytes/entry.size*100);callback(null,chunk)}});
        await pipeline(Readable.fromWeb(response.body),meter,require('node:fs').createWriteStream(partial,{mode:0o600}));
        if(bytes!==entry.size||hash.digest('hex')!==entry.sha256)throw Error('download-checksum');
        await fs.rename(partial,target);downloaded=target;
      } catch(error){await fs.rm(partial,{force:true});throw error}
    },
    async install(){
      if(!downloaded||await digest(downloaded)!==entry.sha256)throw Error('download-checksum');
      const error=await openPath(downloaded);if(error)throw Error('open-installer');
    }
  };
}
module.exports={macEngine,validateManifest};
