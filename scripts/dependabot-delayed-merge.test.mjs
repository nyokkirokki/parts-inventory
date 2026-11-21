import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseVersion, validateManifestUpgrade, parseLock, validateLockUpgrade, oldEnough,
} from './dependabot-delayed-merge.mjs';

const oldPkg = {
  name: 'inventory', scripts: { build: 'tsc' }, packageManager: 'pnpm@10.0.0',
  dependencies: { hono: '^4.10.0', react: '^19.0.0',
    xlsx: 'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz' },
  devDependencies: { vite: '^8.1.0' },
};
const newPkg = { ...oldPkg, dependencies: { ...oldPkg.dependencies, hono: '^4.11.0' } };
const oldLock = [
  "lockfileVersion: '9.0'", 'packages:', '  hono@4.10.0:',
  '    resolution: {integrity: sha512-old}', '  react@19.0.0:',
  '    resolution: {integrity: sha512-same}', 'snapshots:', '  hono@4.10.0: {}', '',
].join('\n');
const newLock = oldLock.replaceAll('hono@4.10.0', 'hono@4.11.0').replace('sha512-old', 'sha512-new');

test('minor/patch version parser and allowlist', () => {
  assert.deepEqual(parseVersion('^4.11.0').v, [4, 11, 0]);
  assert.deepEqual(validateManifestUpgrade(oldPkg, newPkg), [{ name: 'hono', version: '4.11.0' }]);
});
test('Major, prerelease, downgrade, non-semver, and 0.x blocked', () => {
  for (const value of ['^5.0.0', '^4.11.0-beta.1', '^4.9.0', 'npm:hono@4.11.0', '^0.8.0']) {
    assert.throws(() => validateManifestUpgrade(oldPkg, {
      ...newPkg, dependencies: { ...newPkg.dependencies, hono: value },
    }));
  }
});
test('Script and package manager tampering blocked', () => {
  assert.throws(() => validateManifestUpgrade(oldPkg, { ...newPkg, scripts: { build: 'evil' } }));
  assert.throws(() => validateManifestUpgrade(oldPkg, { ...newPkg, packageManager: 'pnpm@12.0.0' }));
});
test('SheetJS CDN replacement and new dependency blocked', () => {
  assert.throws(() => validateManifestUpgrade(oldPkg, {
    ...newPkg, dependencies: { ...newPkg.dependencies, xlsx: '^0.18.5' },
  }));
  assert.throws(() => validateManifestUpgrade(oldPkg, {
    ...newPkg, dependencies: { ...newPkg.dependencies, newPackage: '^1.0.0' },
  }));
});
test('pnpm lock parser checks integrity and blocks new transitive majors', () => {
  assert.equal(parseLock(oldLock).size, 2);
  assert.deepEqual(validateLockUpgrade(oldLock, newLock), [{ name: 'hono', version: '4.11.0' }]);
  assert.throws(() => validateLockUpgrade(oldLock, newLock.replace('sha512-same', 'sha512-TAMPERED')));
  assert.throws(() => validateLockUpgrade(oldLock, newLock.replace('react@19.0.0', 'react@20.0.0')));
});
test('Non-registry package changes blocked', () => {
  assert.throws(() => validateLockUpgrade(oldLock, newLock.replaceAll('hono@4.11.0', 'hono@npm:4.11.0')));
});
test('Both PR and published packages must mature for 14 days', () => {
  const now = Date.parse('2026-11-21T00:00:00Z');
  assert.equal(oldEnough('2026-11-01T00:00:00Z', now), true);
  assert.equal(oldEnough('2026-11-13T00:00:00Z', now), false);
  assert.equal(oldEnough('unknown', now), false);
});
