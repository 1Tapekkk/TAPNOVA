'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
assert.ok(['win32', 'darwin'].includes(process.platform), 'Run on a target desktop OS');
const output = process.env.TAPNOVA_PACKAGE_DIR || path.join(root, 'release/desktop');
const bundle = process.platform === 'win32' ? path.join(output, 'win-unpacked')
  : path.join(output, process.arch === 'arm64' ? 'mac-arm64' : 'mac', 'TAPNOVA.app/Contents');
const resources = path.join(bundle, process.platform === 'win32' ? 'resources' : 'Resources');
assert.ok(fs.existsSync(path.join(resources,'app.asar')), 'Packaged application archive exists');
for (const file of fs.readdirSync(path.join(root, 'Resources/Extension'))) {
  const original = path.join(root, 'Resources/Extension', file);
  if (fs.statSync(original).isFile()) assert.ok(fs.readFileSync(original).equals(fs.readFileSync(path.join(resources, 'extension', file))), `Packaged resource is current: ${file}`);
}
const executable = path.join(bundle, process.platform === 'win32' ? 'TAPNOVA.exe' : 'MacOS/TAPNOVA');
assert.ok(fs.existsSync(executable));
if (process.platform === 'darwin') {
  const signature = spawnSync('codesign', ['--verify', '--deep', '--strict', path.dirname(bundle)], {stdio:'inherit'});
  assert.equal(signature.status, 0, 'macOS bundle signature is valid');
}
const smoke = spawnSync(process.execPath, [path.join(__dirname, 'Check-Desktop.cjs')], {
  env: {...process.env, TAPNOVA_TEST_EXE: executable}, stdio:'inherit'
});
assert.equal(smoke.status, 0, 'Packaged application starts and passes integration checks');
console.log(`PASS: ${process.platform}/${process.arch} packaged resources and native application.`);
