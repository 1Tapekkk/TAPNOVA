export const WELCOME_ASSET='/discord/welcome-background.png';
export const WELCOME_ORIGIN='https://tapnova-licenses.tapnova-1tapekkk.workers.dev';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function avatarUrl(member){
 const u=member.user;
 if(/^\d{17,20}$/.test(u?.id)&&/^(a_)?[a-f0-9]{32}$/.test(u.avatar||''))return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=256`;
 const n=/^\d{17,20}$/.test(u?.id)?Number((BigInt(u.id)>>22n)%6n):0;
 return `https://cdn.discordapp.com/embed/avatars/${n}.png`;
}
export function welcomeHtml(member,count,background=WELCOME_ORIGIN+WELCOME_ASSET){
 if(background!==WELCOME_ORIGIN+WELCOME_ASSET&&!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(background))throw Error('invalid-background');
 const name=String(member.nick||member.user.global_name||member.user.username||'Nowy członek').slice(0,80);
 const size=name.length>32?28:name.length>21?36:46;
 return `<!doctype html><html lang="pl"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https://cdn.discordapp.com ${WELCOME_ORIGIN}; style-src 'unsafe-inline'; font-src 'none'"><style>
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:480px;overflow:hidden;background:#130923;color:white;font-family:Arial,sans-serif}
.card{position:relative;width:1200px;height:480px;isolation:isolate;background:#180c2c}.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-3}.shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,4,20,.82),rgba(18,7,35,.25) 55%,rgba(8,4,20,.65));z-index:-2}.border{position:absolute;inset:20px;border:1px solid #d5adff44;border-radius:24px}.copy{position:absolute;left:65px;top:99px}.eyebrow{font-size:15px;letter-spacing:5px;font-weight:700;color:#d6b6ff;margin-bottom:24px}.title{font-weight:900;font-size:72px;letter-spacing:-3px;margin:0;line-height:1}.line{height:4px;width:65px;background:#c19aff;margin:24px 0 19px;box-shadow:0 0 22px #ad5aff}.sub{font-size:20px;letter-spacing:.4px;color:#e4d7f6}.foot{position:absolute;bottom:49px;left:65px;color:#d3bde3;font-size:13px;letter-spacing:2px}.profile{position:absolute;left:625px;right:65px;top:64px;text-align:center}.ring{width:202px;height:202px;padding:8px;margin:0 auto 23px;border:2px solid #d1a7ff;border-radius:50%;background:#11081d;box-shadow:0 0 0 7px #bb83ff16,0 0 50px #ab48f94d}.avatar{width:100%;height:100%;object-fit:cover;border-radius:50%;background:#251340}.name{font-size:${size}px;font-weight:800;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;unicode-bidi:plaintext}.count{display:inline-block;margin-top:14px;font-size:16px;color:#d8c7ef;padding:8px 17px;background:#11071f8c;border:1px solid #d1a7ff33;border-radius:40px}
</style><div class="card"><img class="bg" src="${background}"><div class="shade"></div><div class="border"></div><div class="copy"><div class="eyebrow">SPOŁECZNOŚĆ TAPNOVA</div><h1 class="title">WITAJ!</h1><div class="line"></div><div class="sub">Dobrze Cię widzieć wśród nas.</div></div><div class="foot">TWOJA PRZESTRZEŃ. TWOJA EKIPA.</div><div class="profile"><div class="ring"><img class="avatar" src="${esc(avatarUrl(member))}"></div><div class="name">${esc(name)}</div><div class="count">Jest nas już ${Number.isSafeInteger(count)&&count>0?count:'więcej'}!</div></div></div></html>`;
}
export async function renderWelcome(env,member,count){
 if(!env.BROWSER?.quickAction)throw Error('browser-not-configured');
 // Embed the local background so rendering never depends on an outbound
 // browser request back to this Worker (which may be blocked or challenged).
 const asset=await env.ASSETS.fetch(new Request(WELCOME_ORIGIN+'/discord/welcome-background.jpg'));
 if(!asset.ok)throw Error('background-unavailable');
 const buffer=new Uint8Array(await asset.arrayBuffer());if(buffer.length>750000)throw Error('background-too-large');
 let binary='';for(let i=0;i<buffer.length;i+=8192)binary+=String.fromCharCode(...buffer.subarray(i,i+8192));
 const r=await env.BROWSER.quickAction('screenshot',{html:welcomeHtml(member,count,'data:image/jpeg;base64,'+btoa(binary)),viewport:{width:1200,height:480,deviceScaleFactor:1},screenshotOptions:{type:'png'},gotoOptions:{waitUntil:'networkidle0',timeout:10000}});
 if(!r.ok){await r.body?.cancel();throw Error('browser-'+r.status)}
 const bytes=new Uint8Array(await r.arrayBuffer());
 if(bytes.length>5*1024*1024||bytes[0]!==137||bytes[1]!==80||bytes[2]!==78||bytes[3]!==71)throw Error('browser-invalid-image');
 return bytes;
}
