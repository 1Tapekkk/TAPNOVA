'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const directory=path.resolve(process.env.LICENSE_DATA_DIR||path.join(__dirname,'.data'));
fs.mkdirSync(directory,{recursive:true,mode:0o700});
const target=path.join(directory,'config.json');if(fs.existsSync(target))throw Error('Server is already initialized; existing configuration will not be overwritten');
const password=crypto.randomBytes(24).toString('base64url'),salt=crypto.randomBytes(32).toString('hex');
fs.writeFileSync(target,JSON.stringify({secret:crypto.randomBytes(32).toString('hex'),salt,passwordHash:crypto.scryptSync(password,salt,64).toString('hex')},null,2),{mode:0o600,flag:'wx'});
console.log('Server initialized. Save this owner password now; it is not written to a file:\n'+password);
