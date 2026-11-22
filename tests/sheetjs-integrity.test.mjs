import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  assertSheetJsIntegrity,
  repairMissingSheetJsIntegrity,
  SHEETJS_URL,
  SHEETJS_INTEGRITY,
} from '../scripts/sheetjs-integrity.mjs';

const manifest = { dependencies: { xlsx: SHEETJS_URL } };
const good = `lockfileVersion: '9.0'\npackages:\n\n  xlsx@${SHEETJS_URL}:\n    resolution: {integrity: ${SHEETJS_INTEGRITY}, tarball: ${SHEETJS_URL}}\n    version: 0.20.3\n\nsnapshots:\n`;
const missing = good.replace(`integrity: ${SHEETJS_INTEGRITY}, `, '');

test('accepts the approved integrity and never rewrites it', () => {
  assert.doesNotThrow(() => assertSheetJsIntegrity(good, manifest));
  assert.equal(repairMissingSheetJsIntegrity(good, manifest), good);
});
test('fails before install when integrity is missing', () => {
  assert.throws(() => assertSheetJsIntegrity(missing, manifest), /missing or different/);
});
test('restores ONLY the approved missing hash, preserving line endings', () => {
  assert.equal(repairMissingSheetJsIntegrity(missing, manifest), good);
  assert.equal(repairMissingSheetJsIntegrity(missing.replaceAll('\n', '\r\n'), manifest), good.replaceAll('\n', '\r\n'));
});
test('refuses to overwrite an unexpected SHA-512', () => {
  const altered = good.replace(SHEETJS_INTEGRITY, 'sha512-ATTACKER==');
  assert.throws(() => assertSheetJsIntegrity(altered, manifest));
  assert.throws(() => repairMissingSheetJsIntegrity(altered, manifest), /Refusing/);
});
test('refuses unexpected source, version, or additional xlsx entries', () => {
  assert.throws(() => repairMissingSheetJsIntegrity(missing, { dependencies: { xlsx: 'https://invalid.test/x.tgz' } }), /Unapproved/);
  assert.throws(() => repairMissingSheetJsIntegrity(missing.replaceAll(SHEETJS_URL, 'https://invalid.test/x.tgz'), manifest), /exactly one/);
  assert.throws(() => repairMissingSheetJsIntegrity(missing.replace('version: 0.20.3', 'version: 0.18.5'), manifest), /Unexpected SheetJS lockfile version/);
  assert.throws(() => repairMissingSheetJsIntegrity(missing + `\n  xlsx@${SHEETJS_URL}:\n    resolution: {tarball: ${SHEETJS_URL}}\n`, manifest), /additional SheetJS/);
});
test('refuses unexpected resolution metadata', () => {
  const altered = missing.replace(`tarball: ${SHEETJS_URL}`, `tarball: ${SHEETJS_URL}, extra: bad`);
  assert.throws(() => repairMissingSheetJsIntegrity(altered, manifest), /Refusing/);
});
test('actual committed lockfile retains the approved SHA-512', () => {
  assertSheetJsIntegrity(readFileSync('pnpm-lock.yaml', 'utf8'), JSON.parse(readFileSync('package.json', 'utf8')));
});
