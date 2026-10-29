'use strict';
// All authentication is handled by Wrangler OAuth. Secrets travel over stdin, never argv.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'license-server/cloudflare'),configFile=path.join(dir,'wrangler.local.json');
const wrangler=path.join(path.dirname(require.resolve('wrangler/package.json')),'bin/wrangler.js');
const secretsFile=path.join(root,'license-server/.data/cloudflare-secrets.json');
function run(args,{input,capture=false}={}){
 const r=spawnSync(process.execPath,[wrangler,...args],{cwd:root,windowsHide:true,encoding:'utf8',input,env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:input!==undefined||capture?['pipe','pipe','pipe']:'inherit'});
 if(r.status!==0)throw Error('Wrangler: '+args.slice(0,3).join(' ')+' nie powiodlo sie.'+(input!==undefined?'':(r.stderr||r.stdout||'')));
 return r.stdout||'';
}
async function main(){
 if(!fs.existsSync(secretsFile))throw Error('Najpierw uruchom: pnpm cloudflare:setup');
 const secrets=JSON.parse(fs.readFileSync(secretsFile,'utf8'));
 for(const name of ['LICENSE_SECRET','ADMIN_SALT','ADMIN_VERIFIER'])if(!/^[a-f0-9]{64}$/.test(secrets[name]))throw Error('Nieprawidlowa konfiguracja sekretow.');
 const base=JSON.parse(fs.readFileSync(path.join(dir,'wrangler.json'),'utf8'));
 const existing=fs.existsSync(configFile)?JSON.parse(fs.readFileSync(configFile,'utf8')):null;
 const config={...base,...(existing?.account_id?{account_id:existing.account_id}:{})};
 if(existing)config.d1_databases=existing.d1_databases;
 fs.writeFileSync(configFile,JSON.stringify(config,null,2));
 const flag=['--config',configFile];
 if(config.d1_databases[0].database_id.startsWith('00000000')){
  let databases=JSON.parse(run(['d1','list','--json',...flag],{capture:true}));
  let db=databases.find(d=>d.name==='tapnova-licenses');
  if(!db){run(['d1','create','tapnova-licenses','--location','weur','--update-config=false',...flag]);databases=JSON.parse(run(['d1','list','--json',...flag],{capture:true}));db=databases.find(d=>d.name==='tapnova-licenses')}
  if(!db?.uuid)throw Error('Nie znaleziono identyfikatora bazy D1.');
  config.d1_databases[0].database_id=db.uuid;fs.writeFileSync(configFile,JSON.stringify(config,null,2));
 }
 run(['d1','migrations','apply','DB','--remote',...flag]);
 const count=JSON.parse(run(['d1','execute','DB','--remote','--json','--command','SELECT count(*) AS n FROM licenses',...flag],{capture:true}))[0].results[0].n;
 const localFile=path.join(root,'license-server/.data/licenses.sqlite'),localConfig=path.join(root,'license-server/.data/config.json');
 if(count===0&&fs.existsSync(localFile)&&fs.existsSync(localConfig)){
  if(JSON.parse(fs.readFileSync(localConfig,'utf8')).secret!==secrets.LICENSE_SECRET)throw Error('Import wymaga tego samego sekretu HMAC.');
  const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(localFile,{readOnly:true});let rows;
  try{rows=db.prepare('SELECT * FROM licenses').all()}finally{db.close()}
  if(rows.length){
   const fields=['id','key_hash','hint','label','duration','max_devices','created','activated','expires','revoked'];
   const quote=v=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
   const sql=rows.map(row=>'INSERT INTO licenses('+fields.join(',')+') VALUES('+fields.map(f=>quote(row[f])).join(',')+');').join('\n');
   const transfer=path.join(root,'license-server/.data/cloudflare-import.sql');
   fs.writeFileSync(transfer,sql,{mode:0o600});try{run(['d1','execute','DB','--remote','--file',transfer,...flag])}finally{fs.rmSync(transfer,{force:true})}
   console.log('Przeniesiono licencje: '+rows.length+'. Urzadzenia nalezy aktywowac ponownie w wersji z adresem Cloudflare.');
  }
 }
 // Uploading secrets may create a placeholder Worker on its first run. The real code follows.
 run(['secret','bulk',...flag],{input:JSON.stringify(secrets)});
 run(['deploy',...flag]);
 console.log('\nSerwer opublikowany. Otworz adres workers.dev pokazany powyzej i zaloguj sie.');
 console.log('Instrukcja i limity darmowego planu: docs/CLOUDFLARE-PL.md.');
 console.log('Ustaw ten adres jako zmienna GitHub TAPNOVA_LICENSE_URL przed budowaniem Windows/macOS.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
