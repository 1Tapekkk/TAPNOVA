'use strict';
const assert=require('node:assert/strict');
const {createPhotographer}=require('../desktop/photo.cjs');
(async()=>{
 const calls=[],wc={getURL:()=> 'https://moviestarplanet2.com/',isDestroyed:()=>false,executeJavaScript:async code=>calls.push(code),capturePage:async()=>({isEmpty:()=>false,toPNG:()=>Buffer.from('png')})};
 const take=createPhotographer({wait:async()=>{}}),base={webContents:wc,chooseFile:async()=>({filePath:'chosen.png'}),writeFile:async(file,bytes)=>{assert.equal(file,'chosen.png');assert.equal(bytes.toString(),'png')},countdown:n=>calls.push(n)};
 assert.equal((await take(base)).ok,true);assert.deepEqual(calls.slice(0,3),[3,2,1]);assert.match(calls.at(-1),/Restore/);
 let wrote=false;assert.equal((await take({...base,chooseFile:async()=>({canceled:true}),writeFile:async()=>wrote=true})).cancelled,true);assert.equal(wrote,false);
 await assert.rejects(()=>take({...base,webContents:{...wc,capturePage:async()=>{throw Error('capture-failed')}}}),/capture-failed/);assert.match(calls.at(-1),/Restore/);
 await assert.rejects(()=>take({...base,valid:()=>false}),/photo-interrupted/);
 await assert.rejects(()=>take({...base,writeFile:async()=>{throw Error('disk-full')}}),/disk-full/);assert.equal((await take(base)).ok,true,'Lock released after errors');
 let release;const waiting=createPhotographer({wait:()=>new Promise(r=>release=r)});const first=waiting({...base,valid:()=>!wrote});assert.equal((await waiting(base)).busy,true);wrote=true;release();await assert.rejects(()=>first,/photo-interrupted/);
 console.log('PASS: photo countdown, capture/restore, cancel, invalid view, save errors and concurrency lock.');
})().catch(e=>{console.error(e);process.exitCode=1});
