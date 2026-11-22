import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Previously committed, reviewed vendor artifact. Never trust a digest from a Dependabot diff.
export const SHEETJS_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz';
export const SHEETJS_INTEGRITY = 'sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==';

const key = `  xlsx@${SHEETJS_URL}:`;
const expected = `    resolution: {integrity: ${SHEETJS_INTEGRITY}, tarball: ${SHEETJS_URL}}`;
const withoutIntegrity = `    resolution: {tarball: ${SHEETJS_URL}}`;

function locate(lock, manifest) {
  if (manifest?.dependencies?.xlsx !== SHEETJS_URL) {
    throw new Error('Unapproved SheetJS dependency source; manual security review required');
  }
  const newline = lock.includes('\r\n') ? '\r\n' : '\n';
  const lines = lock.split(newline);
  const indexes = lines.flatMap((line, index) => line === key ? [index] : []);
  if (lines.filter(line => line.startsWith('  xlsx@')).length !== 1) {
    throw new Error('Unexpected additional SheetJS lockfile source');
  }
  if (indexes.length !== 1 || !lines[indexes[0] + 1]?.startsWith('    resolution: ')) {
    throw new Error('Expected exactly one pinned SheetJS lockfile entry');
  }
  if (lines[indexes[0] + 2] !== '    version: 0.20.3') {
    throw new Error('Unexpected SheetJS lockfile version');
  }
  return { lines, index: indexes[0] + 1, newline };
}

export function assertSheetJsIntegrity(lock, manifest) {
  const { lines, index } = locate(lock, manifest);
  if (lines[index] !== expected) {
    throw new Error('SheetJS SHA-512 integrity is missing or different; do not install dependencies');
  }
}

// Opt-in recovery ONLY for the exact missing-hash form; fail closed otherwise.
export function repairMissingSheetJsIntegrity(lock, manifest) {
  const { lines, index, newline } = locate(lock, manifest);
  if (lines[index] === expected) return lock;
  if (lines[index] !== withoutIntegrity) {
    throw new Error('Refusing to overwrite unexpected SheetJS resolution metadata');
  }
  lines[index] = expected;
  const repaired = lines.join(newline);
  assertSheetJsIntegrity(repaired, manifest);
  return repaired;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
  const original = readFileSync('pnpm-lock.yaml', 'utf8');
  if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--repair')) {
    console.error('Usage: node scripts/sheetjs-integrity.mjs [--repair]');
    process.exitCode = 2;
  } else {
    try {
      if (process.argv[2] === '--repair') {
        const repaired = repairMissingSheetJsIntegrity(original, manifest);
        if (repaired !== original) writeFileSync('pnpm-lock.yaml', repaired);
        console.log(repaired === original ? 'SheetJS integrity already intact' : 'Restored approved SheetJS SHA-512 integrity');
      } else {
        assertSheetJsIntegrity(original, manifest);
        console.log('SheetJS pinned tarball SHA-512 integrity verified in lockfile');
      }
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
