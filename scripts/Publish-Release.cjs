'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const {version} = require('../package.json');
if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error('A stable semantic version is required');
const tag = `v${version}`, dir = path.join(root, 'release/publish');
const notes = path.join(root, `docs/releases/${version}.md`);
const assets = [`TAPNOVA-${version}-win-x64.exe`, ...['arm64','x64'].flatMap(arch => ['dmg','zip'].map(ext => `TAPNOVA-${version}-mac-${arch}.${ext}`))];
for (const name of assets) {
  if (!fs.existsSync(path.join(dir,name)) || fs.statSync(path.join(dir,name)).size < 1024*1024) throw Error(`Missing or incomplete installer: ${name}`);
}
if (!fs.existsSync(notes)) throw Error(`Missing release notes: ${notes}`);
fs.copyFileSync(path.join(root,'docs/DESKTOP-PL.md'),path.join(dir,'INSTRUKCJA.md'));
assets.push('INSTRUKCJA.md');
fs.writeFileSync(path.join(dir,'SHA256SUMS.txt'),assets.map(name=>`${crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,name))).digest('hex')}  ${name}`).join('\n')+'\n');
assets.push('SHA256SUMS.txt');
if (process.argv.includes('--check')) { console.log('PASS: complete release assets, notes and checksums.'); process.exit(0); }
if (!/^[0-9a-f]{40}$/.test(process.env.GITHUB_SHA || '')) throw Error('GITHUB_SHA is required');
const gh = (...args) => {
  const result = spawnSync('gh', args, {encoding:'utf8', cwd:root});
  if(result.status!==0)throw Error(result.stderr || 'GitHub CLI failed');
  return result.stdout;
};
// Authentication or network errors must not be mistaken for a new release.
const releases = JSON.parse(gh('release','list','--limit','100','--json','tagName,isDraft'));
const existing = releases.find(release=>release.tagName===tag);
if (existing && !existing.isDraft) {
  console.log(`${tag} is already published. Increase package.json version for a new release.`);
  process.exit(0);
}
if(existing) {
  const release=JSON.parse(gh('release','view',tag,'--json','targetCommitish'));
  if(release.targetCommitish!==process.env.GITHUB_SHA)throw Error('Existing draft belongs to another commit; choose a new version');
} else {
  gh('release','create',tag,'--draft','--target',process.env.GITHUB_SHA,'--title',`TAPNOVA ${version}`,'--notes-file',notes);
}
gh('release','upload',tag,...assets.map(name=>path.join(dir,name)),'--clobber');
gh('release','edit',tag,'--draft=false','--latest');
console.log(`Published ${tag} with Windows x64, macOS Intel and Apple Silicon installers.`);
