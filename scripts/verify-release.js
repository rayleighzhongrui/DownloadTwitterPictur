const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

function verifyRelease(zipPath) {
  const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
  const manifest = readJson('manifest.json');
  const pkg = readJson('package.json');
  const lock = readJson('package-lock.json');
  assert.equal(pkg.version, manifest.version, 'package/manifest version mismatch');
  assert.equal(lock.version, manifest.version, 'lockfile version mismatch');
  assert.equal(lock.packages[''].version, manifest.version, 'lockfile root version mismatch');

  const entries = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).trim().split('\n');
  for (const required of ['manifest.json', 'content.js', 'background.js', 'popup.js', 'inject.js', 'popup.html', 'rules.json', 'images/icon.png', '_locales/en/messages.json']) {
    assert(entries.includes(required), `missing release file: ${required}`);
  }
  for (const entry of entries) {
    assert(!entry.startsWith('/') && !entry.split('/').includes('..'), `unsafe zip path: ${entry}`);
    assert(/^(manifest\.json|(?:content|background|popup)\.js(?:\.map)?|inject\.js|popup\.html|rules\.json|images\/|_locales\/)/.test(entry), `unexpected release entry: ${entry}`);
    if (entry.endsWith('/')) continue;
    const bytes = execFileSync('unzip', ['-p', zipPath, entry], { maxBuffer: 10 * 1024 * 1024 });
    assert(bytes.equals(fs.readFileSync(entry)), `stale release file: ${entry}`);
    if (entry.endsWith('.js')) new vm.Script(bytes.toString('utf8'), { filename: entry });
  }
  const checksum = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
  fs.writeFileSync(`${zipPath}.sha256`, `${checksum}  ${path.basename(zipPath)}\n`);
  console.log(`✅ 发布包字节、版本、路径与脚本语法检查通过 (v${manifest.version})`);
  console.log(`SHA-256: ${checksum}`);
  return checksum;
}

module.exports = { verifyRelease };
if (require.main === module) {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  verifyRelease(process.argv[2] || `DownloadTwitterPicture-v${manifest.version}.zip`);
}
