/* global process, fetch, Buffer, console */
// Runs from trusted main only. No checkout, npm install, or execution of PR code.
import { parseLock, validateLockUpgrade } from './dependabot-lock-guard.mjs';
export { parseLock, validateLockUpgrade } from './dependabot-lock-guard.mjs';

const AGE_MS = 14 * 24 * 60 * 60 * 1000;
const WORKFLOWS = ['ci.yml', 'security-regression.yml', 'browser-e2e.yml', 'backup-restore.yml'];
const ALLOWED = new Set(['package.json', 'pnpm-lock.yaml']);
const FIELDS = ['dependencies', 'devDependencies'];
function deny(message) { throw new Error(message); }

export function oldEnough(time, now = Date.now()) {
  const date = Date.parse(time);
  return Number.isFinite(date) && date <= now - AGE_MS;
}
export function parseVersion(spec) {
  const m = /^(\^|~)?(\d+)\.(\d+)\.(\d+)$/.exec(spec ?? '');
  return m ? { op: m[1] ?? '', v: [Number(m[2]), Number(m[3]), Number(m[4])], version: m.slice(2).join('.') } : null;
}
function newer(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return b[i] > a[i];
  return false;
}
export function validateManifestUpgrade(oldPkg, newPkg) {
  const a = { ...oldPkg }, b = { ...newPkg };
  for (const field of FIELDS) { delete a[field]; delete b[field]; }
  if (JSON.stringify(a) !== JSON.stringify(b)) deny('Scripts, overrides, packageManager, or other metadata changed');
  const changes = [];
  for (const field of FIELDS) {
    const before = oldPkg[field] ?? {}, after = newPkg[field] ?? {};
    const keys = Object.keys(before).sort();
    if (keys.join('\n') !== Object.keys(after).sort().join('\n')) deny('Dependencies added/removed');
    for (const name of keys) {
      if (before[name] === after[name]) continue;
      if (name === 'xlsx') deny('SheetJS CDN is not auto-updated');
      const from = parseVersion(before[name]), to = parseVersion(after[name]);
      if (!from || !to || from.op !== to.op || from.v[0] === 0 ||
          from.v[0] !== to.v[0] || !newer(from.v, to.v)) {
        deny('Unsafe/major/unstable update: ' + name);
      }
      changes.push({ name, version: to.version });
    }
  }
  if (!changes.length) deny('Lockfile-only or unrelated update requires manual review');
  return changes;
}

function githubApi(http, token) {
  return async (path, method = 'GET', payload) => {
    if (!token) deny('GITHUB_TOKEN missing');
    const response = await http('https://api.github.com' + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'trusted-dependabot-delayed-merge',
        ...(payload ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    const body = await response.text();
    if (!response.ok) deny('GitHub API ' + response.status + ' ' + path + ': ' + body.slice(0, 150));
    return JSON.parse(body);
  };
}
async function fileAt(api, repo, path, sha) {
  const data = await api(repo + '/contents/' + path + '?ref=' + encodeURIComponent(sha));
  if (data.encoding !== 'base64') deny('Unexpected file encoding: ' + path);
  return Buffer.from(data.content, 'base64').toString('utf8');
}
async function verifyChangedFiles(api, repo, number) {
  const files = [];
  for (let page = 1; page <= 4; page++) {
    const batch = await api(repo + '/pulls/' + number + '/files?per_page=100&page=' + page);
    files.push(...batch);
    if (batch.length < 100) break;
  }
  if (files.length !== 2 || !files.every(x => x.status === 'modified' && ALLOWED.has(x.filename)) ||
      !files.some(x => x.filename === 'package.json') || !files.some(x => x.filename === 'pnpm-lock.yaml')) {
    deny('Only root package.json + pnpm-lock.yaml changes may auto-merge');
  }
}
async function verifyPublicationAges(http, packages, now) {
  const cache = new Map();
  const unique = [...new Map(packages.map(p => [p.name + '@' + p.version, p])).values()];
  for (const { name, version } of unique) {
    if (!cache.has(name)) {
      const response = await http('https://registry.npmjs.org/' + encodeURIComponent(name), {
        headers: { Accept: 'application/json', 'User-Agent': 'trusted-dependabot-delayed-merge' },
      });
      if (!response.ok) deny('npm registry unavailable: ' + name);
      const metadata = await response.json();
      if (!metadata.time) deny('Missing npm publish history: ' + name);
      cache.set(name, metadata.time);
    }
    if (!oldEnough(cache.get(name)[version], now)) {
      deny('Published less than 14 days ago or unknown: ' + name + '@' + version);
    }
  }
}
async function verifyChecks(api, repo, head) {
  for (const workflow of WORKFLOWS) {
    const results = await api(repo + '/actions/workflows/' + workflow + '/runs?head_sha=' + head.sha +
      '&event=pull_request&per_page=30');
    const runs = (results.workflow_runs ?? []).filter(run =>
      run.head_sha === head.sha && run.head_branch === head.ref && run.event === 'pull_request'
    ).sort((a, b) => b.id - a.id);
    if (!runs.length || runs[0].status !== 'completed' || runs[0].conclusion !== 'success') {
      deny('CI not green: ' + workflow);
    }
  }
}
async function evaluate(api, http, repo, pr, slug, now) {
  if (pr.user?.login !== 'dependabot[bot]' || pr.draft ||
      pr.base?.ref !== 'main' || pr.head?.repo?.full_name !== slug ||
      !pr.head?.ref?.startsWith('dependabot/npm_and_yarn/') ||
      !oldEnough(pr.created_at, now) || !oldEnough(pr.updated_at, now) ||
      pr.mergeable !== true || pr.mergeable_state !== 'clean') {
    deny('Bot, stability, mergeability, or branch condition not satisfied');
  }
  await verifyChangedFiles(api, repo, pr.number);
  const previous = JSON.parse(await fileAt(api, repo, 'package.json', pr.base.sha));
  const updated = JSON.parse(await fileAt(api, repo, 'package.json', pr.head.sha));
  const direct = validateManifestUpgrade(previous, updated);
  const before = await fileAt(api, repo, 'pnpm-lock.yaml', pr.base.sha);
  const after = await fileAt(api, repo, 'pnpm-lock.yaml', pr.head.sha);
  const indirect = validateLockUpgrade(before, after, previous, updated);
  await verifyPublicationAges(http, [...direct, ...indirect], now);
  await verifyChecks(api, repo, pr.head);
  const compare = await api(repo + '/compare/' + pr.base.sha + '...' + pr.head.sha);
  if (compare.behind_by !== 0 || compare.ahead_by < 1) deny('PR out of date with main');
  return { sha: pr.head.sha, base: pr.base.sha, updated: pr.updated_at };
}

export async function runAutoMerge({
  http = fetch, token = process.env.GITHUB_TOKEN, repository = process.env.GITHUB_REPOSITORY,
  now = Date.now(), logger = console,
} = {}) {
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository ?? '')) deny('Invalid repository');
  const api = githubApi(http, token), repo = '/repos/' + repository;
  const main = await api(repo + '/branches/main');
  if (!main.protected) deny('main requires branch protection + required CI checks before automatic merging');
  const prs = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await api(repo + '/pulls?state=open&per_page=100&page=' + page);
    prs.push(...batch);
    if (batch.length < 100) break;
  }
  let skipped = 0;
  for (const candidate of prs) {
    if (candidate.user?.login !== 'dependabot[bot]') continue;
    try {
      const pr = await api(repo + '/pulls/' + candidate.number);
      const approved = await evaluate(api, http, repo, pr, repository, now);
      const fresh = await api(repo + '/pulls/' + candidate.number);
      const branch = await api(repo + '/branches/main');
      if (!branch.protected || branch.commit.sha !== approved.base || fresh.state !== 'open' ||
          fresh.head.sha !== approved.sha || fresh.base.sha !== approved.base ||
          fresh.updated_at !== approved.updated) {
        deny('PR or main changed while evaluating');
      }
      const result = await api(repo + '/pulls/' + candidate.number + '/merge', 'PUT', {
        sha: approved.sha, merge_method: 'squash',
        commit_title: 'chore(deps): merge 14-day mature Dependabot PR #' + candidate.number,
      });
      if (!result.merged) deny('Merge not completed');
      logger.log('Merged PR #' + candidate.number + ' after all maturity and CI gates');
      return { merged: candidate.number, skipped };
    } catch (error) {
      skipped++;
      logger.log('Skipped PR #' + candidate.number + ': ' + error.message);
    }
  }
  return { merged: null, skipped };
}
if (process.argv[1]?.endsWith('/dependabot-delayed-merge.mjs')) {
  runAutoMerge().catch(error => { console.error(error); process.exitCode = 1; });
}
