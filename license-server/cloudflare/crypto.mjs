const utf8 = new TextEncoder();
export const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
export const random = (size=32) => hex(crypto.getRandomValues(new Uint8Array(size)));
export const sha = async value => hex(await crypto.subtle.digest('SHA-256', utf8.encode(value)));
export async function hasher(secret) {
  const key = await crypto.subtle.importKey('raw', utf8.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return async value => hex(await crypto.subtle.sign('HMAC', key, utf8.encode(value)));
}
export function equal(a,b) {
  if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}
