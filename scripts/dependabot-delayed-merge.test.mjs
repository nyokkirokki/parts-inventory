/* global URL, structuredClone, Buffer */
import assert from 'node:assert/strict';
import test from 'node:test';
import { runAutoMerge, parseVersion, validateManifestUpgrade, parseLock, validateLockUpgrade, oldEnough } from './dependabot-delayed-merge.mjs';

const TODAY = Date.parse('2026-11-21T00:00:00Z');
const PAST = '2026-11-01T00:00:00Z';
const RECENT = '2026-11-13T00:00:00Z';
const SHA = { base: 'a'.repeat(40), head: 'b'.repeat(40) };

const oldPkg = {
  name: 'inventory', scripts: { build: 'tsc' }, packageManager: 'pnpm@10.0.0',
  dependencies: { hono: '^4.10.0', react: '^19.0.0',
    xlsx: 'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz' },
  devDependencies: { vite: '^8.1.0' },
};
const newPkg = { ...oldPkg, dependencies: { ...oldPkg.dependencies, hono: '^4.11.0' } };

function lock(version, integrity = 'AAA==') {
  return [
    "lockfileVersion: '9.0'", '', 'settings:', '  autoInstallPeers: true',
    '  excludeLinksFromLockfile: false', '', 'overrides:',
    '  dompurify: ^3.4.18', '', 'importers:', '', '  .:',
    '    dependencies:', '      hono:', '        specifier: ^' + version,
    '        version: ' + version, '      react:',
    '        specifier: ^19.0.0', '        version: 19.0.0',
    '      xlsx:', '        specifier: https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz',
    '        version: https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz',
    '    devDependencies:', '      vite:', '        specifier: ^8.1.0',
    '        version: 8.1.0', '', 'packages:', '',
    '  hono@' + version + ':', '    resolution: {integrity: sha512-' + integrity + '}',
    '  react@19.0.0:', '    resolution: {integrity: sha512-CCC==}',
    '  vite@8.1.0:', '    resolution: {integrity: sha512-DDD==}', '',
    'snapshots:', '', '  hono@' + version + ': {}',
    '  react@19.0.0: {}', '  vite@8.1.0: {}', '',
  ].join('\n');
}
const oldLock = lock('4.10.0', 'AAA==');
const newLock = lock('4.11.0', 'BBB==');

test('minor and patch manifest upgrades allowed', () => {
  assert.deepEqual(parseVersion('^4.11.0').v, [4, 11, 0]);
  assert.deepEqual(validateManifestUpgrade(oldPkg, newPkg), [{ name: 'hono', version: '4.11.0' }]);
  const patch = { ...oldPkg, dependencies: { ...oldPkg.dependencies, hono: '^4.10.1' } };
  assert.deepEqual(validateManifestUpgrade(oldPkg, patch), [{ name: 'hono', version: '4.10.1' }]);
});
test('major, prerelease, downgrade, alias, 0.x, and script mutations blocked', () => {
  for (const v of ['^5.0.0', '^4.11.0-beta.1', '^4.9.0', 'npm:hono@4.11.0', '^0.8.0']) {
    assert.throws(() => validateManifestUpgrade(oldPkg, {
      ...newPkg, dependencies: { ...newPkg.dependencies, hono: v },
    }));
  }
  assert.throws(() => validateManifestUpgrade(oldPkg, { ...newPkg, scripts: { build: 'evil' } }));
  assert.throws(() => validateManifestUpgrade(oldPkg, { ...newPkg, packageManager: 'pnpm@12.0.0' }));
  assert.throws(() => validateManifestUpgrade(oldPkg, {
    ...newPkg, dependencies: { ...newPkg.dependencies, xlsx: '^0.18.5' },
  }));
  assert.throws(() => validateManifestUpgrade(oldPkg, {
    ...newPkg, dependencies: { ...newPkg.dependencies, unexpected: '^1.0.0' },
  }));
});
test('lockfile parses package entries and permits registry minor changes', () => {
  assert.equal(parseLock(oldLock).size, 3);
  assert.deepEqual(validateLockUpgrade(oldLock, newLock, oldPkg, newPkg), [
    { name: 'hono', version: '4.11.0' },
  ]);
});
test('lockfile rejects metadata, overrides, importer specifier and unrelated importer changes', () => {
  for (const bad of [
    newLock.replace('autoInstallPeers: true', 'autoInstallPeers: false'),
    newLock.replace('dompurify: ^3.4.18', 'dompurify: ^1.0.0'),
    newLock.replace('specifier: ^4.11.0', 'specifier: ^4.99.0'),
    newLock.replace('        specifier: ^19.0.0', '        specifier: ^18.0.0'),
    newLock.replace('importers:', 'importers:\n\n  evil:\n    dependencies:\n      attacker:\n        specifier: ^1.0.0\n        version: 1.0.0'),
    newLock.replace('      react:', '      injected:\n        specifier: ^1.0.0\n        version: 1.0.0\n      react:'),
  ]) assert.throws(() => validateLockUpgrade(oldLock, bad, oldPkg, newPkg));
});
test('lockfile rejects unchanged integrity, snapshot, ghost snapshots and missing new integrity', () => {
  for (const bad of [
    newLock.replace('sha512-CCC==', 'sha512-ALTERED=='),
    newLock.replace('  react@19.0.0: {}', '  react@19.0.0:\n    evil: true'),
    newLock.replace('  react@19.0.0: {}', '  react@19.0.0: {}\n  ghost@1.0.0: {}'),
    newLock.replace('sha512-BBB==', 'UNVERIFIED'),
    newLock.replaceAll('hono@4.11.0', 'hono@5.0.0'),
    newLock.replaceAll('hono@4.11.0', 'hono@npm:4.11.0'),
  ]) assert.throws(() => validateLockUpgrade(oldLock, bad, oldPkg, newPkg));
});
test('strict 14-day age boundaries', () => {
  const threshold = new Date(TODAY - 14 * 86400000);
  assert.equal(oldEnough(threshold.toISOString(), TODAY), true);
  assert.equal(oldEnough(new Date(threshold.getTime() + 1000).toISOString(), TODAY), false);
  assert.equal(oldEnough(new Date(threshold.getTime() - 1000).toISOString(), TODAY), true);
  assert.equal(oldEnough('invalid', TODAY), false);
  assert.equal(oldEnough(RECENT, TODAY), false);
});

function makeMock(options = {}) {
  const calls = [];
  const pr = {
    number: 42, state: 'open', draft: false, created_at: PAST, updated_at: PAST,
    user: { login: 'dependabot[bot]' }, base: { ref: 'main', sha: SHA.base },
    head: { sha: SHA.head, ref: 'dependabot/npm_and_yarn/hono-4.11.0',
      repo: { full_name: 'demo/inventory' } },
    mergeable: true, mergeable_state: 'clean',
  };
  Object.assign(pr, options.pr ?? {});
  let prLookups = 0, branchLookups = 0, merged = 0;
  const ok = value => ({ ok: true, status: 200, text: async () => JSON.stringify(value), json: async () => value });
  const err = status => ({ ok: false, status, text: async () => JSON.stringify({ message: 'test failure' }) });
  async function http(url, init = {}) {
    const u = new URL(url), p = u.pathname;
    calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : null });
    if (options.failOn?.(url)) return err(options.failStatus ?? 500);
    if (u.hostname === 'registry.npmjs.org') {
      const age = options.publishDate ?? PAST;
      return ok({ time: { '4.11.0': age } });
    }
    const root = '/repos/demo/inventory';
    if (p === root + '/branches/main') {
      branchLookups++;
      const sha = options.mainMoves && branchLookups > 1 ? 'c'.repeat(40) : SHA.base;
      return ok({ protected: options.protected !== false, commit: { sha } });
    }
    if (p === root + '/pulls' && u.searchParams.get('state') === 'open') {
      return ok(u.searchParams.get('page') === '1' ? [pr] : []);
    }
    if (p === root + '/pulls/42' && init.method !== 'PUT') {
      prLookups++;
      const value = structuredClone(pr);
      if (options.prChanges && prLookups >= 2) value.head.sha = 'd'.repeat(40);
      return ok(value);
    }
    if (p === root + '/pulls/42/files') {
      const files = options.files ?? [
        { filename: 'package.json', status: 'modified' },
        { filename: 'pnpm-lock.yaml', status: 'modified' },
      ];
      return ok(files);
    }
    if (p.startsWith(root + '/contents/')) {
      const path = p.split('/contents/')[1], head = u.searchParams.get('ref') === SHA.head;
      const value = path === 'package.json' ? JSON.stringify(head ? newPkg : oldPkg) :
        head ? (options.lock ?? newLock) : oldLock;
      return ok({ encoding: 'base64', content: Buffer.from(value).toString('base64') });
    }
    if (p.includes('/actions/workflows/') && p.endsWith('/runs')) {
      const workflow = p.split('/actions/workflows/')[1].split('/runs')[0];
      return ok({ workflow_runs: [{
        id: options.latestCiFailed ? 100 : 10, status: options.ciPending ? 'in_progress' : 'completed',
        conclusion: options.latestCiFailed ? 'failure' : 'success', head_sha: SHA.head,
        head_branch: pr.head.ref, event: 'pull_request',
      }] });
    }
    if (p === root + '/compare/' + SHA.base + '...' + SHA.head) {
      return ok({ behind_by: options.outdated ? 1 : 0, ahead_by: 1 });
    }
    if (p === root + '/pulls/42/merge' && init.method === 'PUT') {
      merged++;
      return ok({ merged: true });
    }
    throw new Error('Unmocked request: ' + url);
  }
  return {
    http, calls, merged: () => merged,
    options: { repository: 'demo/inventory', token: 'dummy-test-token', now: TODAY,
      logger: { log() {} }, http },
  };
}

test('guarded API path: old minor PR, old published package, all green checks => one guarded squash merge', async () => {
  const mock = makeMock();
  assert.deepEqual(await runAutoMerge(mock.options), { merged: 42, skipped: 0 });
  assert.equal(mock.merged(), 1);
  const merges = mock.calls.filter(c => c.method === 'PUT');
  assert.equal(merges.length, 1);
  assert.equal(merges[0].body.sha, SHA.head);
  assert.equal(merges[0].body.merge_method, 'squash');
  assert.ok(mock.calls.some(c => c.url.includes('/actions/workflows/browser-e2e.yml/runs')));
});

test('unprotected branch blocks entire run before reading any PR', async () => {
  const mock = makeMock({ protected: false });
  await assert.rejects(runAutoMerge(mock.options), /branch protection/);
  assert.equal(mock.merged(), 0);
  assert.equal(mock.calls.length, 1);
});
test('PR opened too recently OR updated too recently never merges', async () => {
  for (const field of ['created_at', 'updated_at']) {
    const mock = makeMock({ pr: { [field]: RECENT } });
    assert.equal((await runAutoMerge(mock.options)).merged, null);
    assert.equal(mock.merged(), 0);
  }
});
test('newly published package and unavailable npm registry block merge', async () => {
  for (const options of [
    { publishDate: RECENT },
    { failOn: url => url.includes('registry.npmjs.org') },
  ]) {
    const mock = makeMock(options);
    assert.equal((await runAutoMerge(mock.options)).merged, null);
    assert.equal(mock.merged(), 0);
  }
});
test('API outage, failed/re-running CI, outdated PR, and changed head/base block merge', async () => {
  for (const opts of [
    { failOn: url => url.includes('/pulls/42/files') },
    { latestCiFailed: true }, { ciPending: true }, { outdated: true },
    { prChanges: true }, { mainMoves: true },
    { files: [{ filename: 'package.json', status: 'modified' }, { filename: 'worker.ts', status: 'modified' }] },
    { lock: newLock.replace('sha512-CCC==', 'sha512-MALICIOUS==') },
    { pr: { user: { login: 'untrusted-bot' } } },
    { pr: { mergeable_state: 'blocked' } },
  ]) {
    const mock = makeMock(opts);
    const result = await runAutoMerge(mock.options);
    assert.equal(result.merged, null, JSON.stringify(opts));
    assert.equal(mock.merged(), 0);
  }
});
