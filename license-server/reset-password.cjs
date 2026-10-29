'use strict';
// Run while the license service is stopped, then restart it to invalidate sessions.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const directory=path.resolve(process.env.LICENSE_DATA_DIR||path.join(__dirname,'.data'));
const file=path.join(directory,'config.json'),config=JSON.parse(fs.readFileSync(file,'utf8'));
const password='MlodyAlan-'+crypto.randomBytes(12).toString('base64url')+'!';config.salt=crypto.randomBytes(32).toString('hex');config.passwordHash=crypto.scryptSync(password,config.salt,64).toString('hex');
fs.writeFileSync(file,JSON.stringify(config,null,2),{mode:0o600});
fs.rmSync(path.join(directory,'OWNER-LOGIN.txt'),{force:true});
console.log('Owner password reset. Save it now; it is not written to a file:\n'+password+'\nRestart the service to invalidate existing admin sessions. License keys are unchanged.');
