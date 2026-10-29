'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'license-server/.data'),file=path.join(folder,'cloudflare-secrets.json');
function main(){
 if(fs.existsSync(file)&&!process.argv.includes('--reset-owner')){console.log('Haslo Cloudflare jest juz skonfigurowane.');return}
 let owner;
 if(process.env.TAPNOVA_OWNER_PASSWORD){
  const password=process.env.TAPNOVA_OWNER_PASSWORD;delete process.env.TAPNOVA_OWNER_PASSWORD;
  if(password.length<14)throw Error('Haslo musi miec minimum 14 znakow.');
  const salt=crypto.randomBytes(32).toString('hex'),proof=crypto.pbkdf2Sync(password,salt,600000,32,'sha256').toString('hex');
  owner={ADMIN_SALT:salt,ADMIN_VERIFIER:crypto.createHash('sha256').update(proof).digest('hex')};
 }else if(process.platform==='win32'){
  const result=spawnSync('powershell.exe',['-NoProfile','-STA','-WindowStyle','Normal','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'Cloudflare-Owner-Password.ps1')],{windowsHide:false,encoding:'utf8'});
  if(result.status!==0)throw Error('Nie zapisano hasla. Uruchom konfiguracje ponownie.');
  owner=JSON.parse(result.stdout.trim());
 }else throw Error('Ustaw TAPNOVA_OWNER_PASSWORD w srodowisku procesu konfiguracji. Nie zapisuj go w repozytorium.');
 if(!/^[a-f0-9]{64}$/.test(owner.ADMIN_SALT)||!/^[a-f0-9]{64}$/.test(owner.ADMIN_VERIFIER))throw Error('Nieprawidlowy skrot hasla.');
 const previous=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
 const local=path.join(folder,'config.json');
 const secret=previous?.LICENSE_SECRET||(fs.existsSync(local)?JSON.parse(fs.readFileSync(local,'utf8')).secret:crypto.randomBytes(32).toString('hex'));
 if(!/^[a-f0-9]{64}$/.test(secret))throw Error('Nieprawidlowy sekret serwera.');
 fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(file,JSON.stringify({...owner,LICENSE_SECRET:secret},null,2),{mode:0o600});
 console.log('Zapisano tylko sol, weryfikator hasla i sekret serwera w ignorowanym katalogu .data. Haslo nie zostalo zapisane.');
}
try{main()}catch(e){console.error(e.message);process.exitCode=1}
