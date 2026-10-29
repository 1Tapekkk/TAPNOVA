'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {promisify}=require('node:util');const scrypt=promisify(crypto.scrypt);
const {createStore}=require('./store.cjs');
function createServer({config,dataDir,origin,secure=true}){
  if(!/^https?:\/\//.test(origin))throw Error('PUBLIC_ORIGIN required');
  if(!/^[a-f0-9]{64}$/.test(config.secret)||!/^[a-f0-9]+$/.test(config.salt)||!/^[a-f0-9]{128}$/.test(config.passwordHash))throw Error('Invalid server configuration. Run setup.cjs first.');
  const store=createStore(path.join(dataDir,'licenses.sqlite'),config.secret),sessions=new Map(),rates=new Map();
  const send=(res,code,body)=>{res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body))};
  const body=async req=>{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16384)throw Object.assign(Error('body-too-large'),{status:413});chunks.push(chunk)}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')};
  const auth=req=>{const token=String(req.headers.cookie||'').match(/(?:^|; )tn_admin=([A-Za-z0-9_-]+)/)?.[1];const session=sessions.get(token);if(!session||session.expires<Date.now()){sessions.delete(token);return null}return token};
  const rate=(req,bucket,max,period)=>{const key=bucket+req.socket.remoteAddress,now=Date.now();let r=rates.get(key);if(!r||r.end<now){r={n:0,end:now+period};rates.set(key,r)}return ++r.n<=max};
  const sweep=setInterval(()=>{for(const[k,v]of sessions)if(v.expires<Date.now())sessions.delete(k);for(const[k,v]of rates)if(v.end<Date.now())rates.delete(k)},60000);sweep.unref();
  const server=http.createServer(async(req,res)=>{
    res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','no-referrer');res.setHeader('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const url=new URL(req.url,'http://localhost'),route=url.pathname;
      if(req.method==='GET'&&['/','/admin.js','/admin.css'].includes(route)){const file=route==='/'?'index.html':route.slice(1);res.setHeader('content-type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'text/javascript');res.setHeader('cache-control','no-store');return res.end(fs.readFileSync(path.join(__dirname,'public',file)))}
      if(route==='/health'&&req.method==='GET')return send(res,200,{ok:true});
      if(!route.startsWith('/api/'))return send(res,404,{error:'not-found'});
      if(req.method==='POST'&&!String(req.headers['content-type']).startsWith('application/json'))return send(res,415,{error:'json-required'});
      if(route.startsWith('/api/admin')){
        if(req.headers.origin&&req.headers.origin!==origin)return send(res,403,{error:'origin'});
        if(req.method==='POST'&&(req.headers.origin!==origin||req.headers['x-tapnova-admin']!=='1'))return send(res,403,{error:'csrf'});
        if(route==='/api/admin/login'&&req.method==='POST'){
          if(!rate(req,'login',8,15*60000))return send(res,429,{error:'rate-limit'});
          const data=await body(req);const value=await scrypt(String(data.password||'').slice(0,1024),config.salt,64);
          if(!crypto.timingSafeEqual(value,Buffer.from(config.passwordHash,'hex')))return send(res,401,{error:'login'});
          const token=crypto.randomBytes(32).toString('base64url');sessions.set(token,{expires:Date.now()+12*3600000});res.setHeader('set-cookie',`tn_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure?'; Secure':''}`);return send(res,200,{ok:true});
        }
        const token=auth(req);if(!token)return send(res,401,{error:'login'});
        if(route==='/api/admin/licenses'&&req.method==='GET')return send(res,200,{licenses:store.list(),audit:store.audit(),serverTime:Date.now()});
        const data=req.method==='POST'?await body(req):{};
        if(route==='/api/admin/logout'&&req.method==='POST'){sessions.delete(token);res.setHeader('set-cookie','tn_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'+(secure?'; Secure':''));return send(res,200,{ok:true})}
        if(route==='/api/admin/licenses'&&req.method==='POST')return send(res,201,store.create(data));
        const match=route.match(/^\/api\/admin\/licenses\/([0-9a-f-]{36})$/);if(match&&req.method==='POST')return send(res,200,store.change(match[1],data));
      } else if(req.method==='POST') {
        if(!rate(req,'client',600,60000))return send(res,429,{error:'rate-limit'});
        const data=await body(req);
        if(route==='/api/activate'){if(!rate(req,'activation',30,60000))return send(res,429,{error:'rate-limit'});return send(res,200,store.activate(data))}
        const token=String(req.headers.authorization||'').replace(/^Bearer /,'');
        if(route==='/api/heartbeat')return send(res,200,store.heartbeat(token,data.deviceId));
        if(route==='/api/deactivate')return send(res,200,store.deactivate(token,data.deviceId));
      }
      send(res,404,{error:'not-found'});
    }catch(error){send(res,error.status||400,{error:error.status?error.message:'invalid-request'})}
  });
  server.on('close',()=>{clearInterval(sweep);store.close()});server.requestTimeout=15000;server.headersTimeout=10000;
  return {server,store};
}
if(require.main===module){
  const dataDir=path.resolve(process.env.LICENSE_DATA_DIR||path.join(__dirname,'.data'));
  const config=JSON.parse(fs.readFileSync(path.join(dataDir,'config.json'),'utf8'));
  const origin=process.env.PUBLIC_ORIGIN||'http://127.0.0.1:8787';
  const secure=origin.startsWith('https://');if(!secure&&!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))throw Error('Public deployment requires HTTPS');
  const {server}=createServer({config,dataDir,origin,secure});server.listen(Number(process.env.PORT||8787),process.env.HOST||'127.0.0.1',()=>console.log('TAPNOVA License Server: '+origin));
}
module.exports={createServer};
