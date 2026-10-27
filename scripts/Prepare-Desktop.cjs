'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'desktop/generated');
fs.mkdirSync(out, { recursive:true });
const template = fs.readFileSync(path.join(root, 'desktop/game-preload.template.cjs'), 'utf8');
fs.writeFileSync(path.join(out, 'game-preload.cjs'), template.replace('/* BOOT_SOURCE */', () => fs.readFileSync(path.join(root,'Resources/Extension/boot.js'),'utf8')));
for (const weight of [400,500,600,700,800]) {
  for (const subset of ['latin','latin-ext']) {
    const name = `inter-${subset}-${weight}-normal.woff2`;
    fs.copyFileSync(path.join(root,'node_modules/@fontsource/inter/files',name),path.join(out,name));
  }
}
fs.copyFileSync(path.join(root,'Resources/Brand/tapnova.svg'),path.join(out,'tapnova.svg'));
fs.copyFileSync(path.join(root,'Resources/Brand/tapnova.png'),path.join(out,'tapnova.png'));
fs.copyFileSync(path.join(root,'node_modules/@fontsource/inter/LICENSE'),path.join(out,'Inter-OFL.txt'));
console.log('Desktop resources ready: isolated bridge, local Inter fonts, brand assets.');
