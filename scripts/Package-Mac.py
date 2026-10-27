"""Assemble unsigned macOS ZIPs without extracting Unix symlinks on Windows.

Uses untouched official Electron binaries, checks their published SHA-256,
and preserves executable modes and framework symlinks in the ZIP itself.
Native execution, signing and notarization still require macOS.
"""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import plistlib
import posixpath
import shutil
import stat
import struct
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = json.loads((ROOT / 'package.json').read_text('utf-8'))
VERSION = PACKAGE['version']
ELECTRON = PACKAGE['devDependencies']['electron']
OUT = ROOT / 'release' / 'desktop'
BASE = f'https://github.com/electron/electron/releases/download/v{ELECTRON}'


def renamed(name):
    # Framework names and their binary paths remain Electron Framework.
    return '/'.join('TAPNOVA' + part[len('Electron'):] if part == 'Electron'
                    or part == 'Electron.app' or part.startswith('Electron Helper')
                    or part.startswith('Electron Login Helper') else part
                    for part in name.split('/'))


def add_file(archive, source, target):
    info = zipfile.ZipInfo(target)
    info.create_system = 3
    info.external_attr = (stat.S_IFREG | 0o644) << 16
    info.compress_type = zipfile.ZIP_DEFLATED
    with archive.open(info, 'w') as dest, source.open('rb') as src:
        shutil.copyfileobj(src, dest, 1024 * 1024)


def build(arch, cache, hashes):
    filename = f'electron-v{ELECTRON}-darwin-{arch}.zip'
    expected = next(line.split()[0] for line in hashes.splitlines()
                    if line.split()[-1].lstrip('*') == filename)
    candidates = list(cache.rglob(filename)) if cache.exists() else []
    source = candidates[0] if candidates else ROOT / 'release' / 'runtime-cache' / filename
    if not source.exists():
        source.parent.mkdir(parents=True, exist_ok=True)
        print(f'Downloading official Electron for {arch}…', flush=True)
        urllib.request.urlretrieve(f'{BASE}/{filename}', source)
    with source.open('rb') as stream:
        actual = hashlib.file_digest(stream, 'sha256').hexdigest()
    if actual != expected:
        raise ValueError(f'SHA-256 mismatch for {filename}')
    target = OUT / f'TAPNOVA-{VERSION}-mac-{arch}.zip'
    print(f'Assembling {target.name} (official runtime SHA-256 verified)…', flush=True)
    with zipfile.ZipFile(source) as original, zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
        for entry in original.infolist():
            name = entry.filename
            if not name.startswith('Electron.app/'):
                if name in ['LICENSE','LICENSES.chromium.html']:
                    add_name = 'ELECTRON-LICENSE.txt' if name == 'LICENSE' else name
                    bundle.writestr('TAPNOVA.app/Contents/Resources/' + add_name, original.read(entry))
                continue
            if name.endswith('/Resources/default_app.asar'):
                continue
            info = copy.copy(entry)
            info.filename = renamed(name)
            info.compress_type = zipfile.ZIP_DEFLATED
            if name.endswith('/Contents/Info.plist') and '/Electron Framework.framework/' not in name:
                data = plistlib.loads(original.read(entry))
                old_exe = data.get('CFBundleExecutable', '')
                data['CFBundleExecutable'] = renamed(old_exe)
                data['CFBundleDisplayName'] = renamed(data.get('CFBundleDisplayName', old_exe))
                data['CFBundleName'] = renamed(data.get('CFBundleName', old_exe))
                data['CFBundleShortVersionString'] = VERSION
                data['CFBundleVersion'] = VERSION
                data.pop('ElectronAsarIntegrity', None)  # Resources/app is a directory.
                data['CFBundleIdentifier'] = 'com.1tapgod.tapnova' + ('.helper' if 'Helper' in old_exe else '')
                if name == 'Electron.app/Contents/Info.plist':
                    data['LSApplicationCategoryType'] = 'public.app-category.games'
                    data['NSHumanReadableCopyright'] = 'created by 1TapGod'
                bundle.writestr(info, plistlib.dumps(data))
            elif stat.S_ISLNK(entry.external_attr >> 16):
                # Keep a symlink entry; never dereference it into a Windows folder.
                bundle.writestr(info, renamed(original.read(entry).decode()).encode())
            elif name.endswith('/Contents/Resources/electron.icns') and name.count('.app/') == 1:
                bundle.writestr(info, (ROOT / 'Resources/Brand/tapnova.icns').read_bytes())
            else:
                with original.open(entry) as src, bundle.open(info, 'w') as dest:
                    shutil.copyfileobj(src, dest, 1024 * 1024)
        prefix = 'TAPNOVA.app/Contents/Resources/'
        for directory, destination in [(ROOT / 'desktop', 'app/desktop'), (ROOT / 'Resources/Extension', 'extension')]:
            for file in sorted(directory.rglob('*')):
                if file.is_file():
                    add_file(bundle, file, prefix + destination + '/' + file.relative_to(directory).as_posix())
        for file in ['package.json', 'LICENSE', 'NOTICE']:
            add_file(bundle, ROOT / file, prefix + 'app/' + file)
        add_file(bundle, ROOT / 'docs/DESKTOP-PL.md', 'INSTRUKCJA.md')
    # Validate the distributable, including every stored file's CRC.
    with zipfile.ZipFile(target) as check:
        assert check.testzip() is None
        names = set(check.namelist())
        for required in ['TAPNOVA.app/Contents/MacOS/TAPNOVA',
                         'TAPNOVA.app/Contents/Resources/app/desktop/main.cjs',
                         'TAPNOVA.app/Contents/Resources/extension/app.js']:
            assert required in names, required
        executable = check.getinfo('TAPNOVA.app/Contents/MacOS/TAPNOVA')
        assert executable.external_attr >> 16 & 0o111
        data = check.read(executable)
        # Official runtimes must match the selected Mach-O CPU architecture.
        assert data[:4] == b'\xcf\xfa\xed\xfe'
        assert struct.unpack_from('<I', data, 4)[0] == {'arm64':0x100000c,'x64':0x1000007}[arch]
        for entry in check.infolist():
            if stat.S_ISLNK(entry.external_attr >> 16):
                target_name = posixpath.normpath(posixpath.join(posixpath.dirname(entry.filename), check.read(entry).decode()))
                # Framework paths often contain another symlink, Versions/Current.
                for _ in range(16):
                    parts = target_name.split('/')
                    for index in range(1, len(parts) + 1):
                        prefix = '/'.join(parts[:index])
                        if prefix in names and stat.S_ISLNK(check.getinfo(prefix).external_attr >> 16):
                            target_name = posixpath.normpath(posixpath.join(posixpath.dirname(prefix), check.read(prefix).decode(), *parts[index:]))
                            break
                    else:
                        break
                assert target_name.startswith('TAPNOVA.app/'), target_name
                assert target_name in names or target_name + '/' in names, (entry.filename, target_name)
    print(f'PASS: {target.name}; architecture, permissions, symlinks, resources and ZIP integrity. Native macOS run pending.', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, default=Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'electron/Cache')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    png = (ROOT / 'Resources/Brand/tapnova.png').read_bytes()
    size = struct.unpack_from('>I', png, 16)[0]
    kind = {128:b'ic07',256:b'ic08',512:b'ic09',1024:b'ic10'}[size]
    (ROOT / 'Resources/Brand/tapnova.icns').write_bytes(b'icns' + struct.pack('>I',len(png)+16) + kind + struct.pack('>I',len(png)+8) + png)
    hashes = urllib.request.urlopen(f'{BASE}/SHASUMS256.txt', timeout=60).read().decode()
    for arch in ['arm64', 'x64']:
        build(arch, args.cache, hashes)
