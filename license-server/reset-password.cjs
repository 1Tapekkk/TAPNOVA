'use strict';
// Run while the license service is stopped, then restart it to invalidate sessions.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const directory=path.resolve(process.env.LICENSE_DATA_DIR||path.join(__dirname,'.data'));
const file=path.join(directory,'config.json'),config=JSON.parse(fs.readFileSync(file,'utf8'));
const password=crypto.randomBytes(24).toString('base64url');config.salt=crypto.randomBytes(32).toString('hex');config.passwordHash=crypto.scryptSync(password,config.salt,64).toString('hex');
fs.writeFileSync(file,JSON.stringify(config,null,2),{mode:0o600});
fs.writeFileSync(path.join(directory,'OWNER-LOGIN.txt'),'TAPNOVA owner password: '+password+'\n',{mode:0o600});
console.log('Owner password reset. Read OWNER-LOGIN.txt privately, then restart the service. Existing license keys are unchanged.');
