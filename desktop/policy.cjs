'use strict';
const GAME_URL = 'https://moviestarplanet2.com/';
function isGameURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'moviestarplanet2.com' || url.hostname.endsWith('.moviestarplanet2.com'));
  } catch { return false; }
}
const tabs = Object.freeze(['profile','auto','bots','homes','misc','emoji','chatroom','spam','settings','radar']);
module.exports = { GAME_URL, isGameURL, tabs };
