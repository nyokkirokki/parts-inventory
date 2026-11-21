/* global process, fetch, Buffer, console */
// Trusted scheduled policy: never execute PR code or allow non-Dependabot PRs.
const DAYS = 14, AGE_MS = DAYS * 86400000;
const WORKFLOWS = ['ci.yml', 'security-regression.yml', 'browser-e2e.yml', 'backup-restore.yml'];
const ALLOWED = new Set(['package.json', 'pnpm-lock.yaml']);
const FIELDS = ['dependencies', 'devDependencies'];
function deny(message) { throw new Error(message); }

export function oldEnough(time, now = Date.now()) {
  const value = Date.parse(time);
  return Number.isFinite(value) && value <= now - AGE_MS;
}
export function parseVersion(spec) {
  const m = /^(\^|~)?(\d+)\.(\d+)\.(\d+)$/.exec(spec ?? '');
  return m ? { op: m[1] ?? '', v: [Number(m[2]), Number(m[3]), Number(m[4])], version: m.slice(2).join('.') } : null;
}
function strictlyNewer(a, b) {
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
      const oldVersion = parseVersion(before[name]), nextVersion = parseVersion(after[name]);
      if (!oldVersion || !nextVersion || oldVersion.op !== nextVersion.op ||
          oldVersion.v[0] === 0 || oldVersion.v[0] !== nextVersion.v[0] ||
          !strictlyNewer(oldVersion.v, nextVersion.v)) deny('Unsafe/major/unstable update: ' + name);
      changes.push({ name, version: nextVersion.version });
    }
  }
  if (!changes.length) deny('Lockfile-only or unrelated update requires manual review');
  return changes;
}
function packageKey(key) {
  const m = /^(.+)@(\d+\.\d+\.\d+(?:-[\da-zA-Z.-]+)?)(?:\(.+\))?$/.exec(key);
  return m ? { name: m[1], version: m[2] } : null;
}
export function parseLock(yaml) {
  const result = new Map();
  let inside = false, key = null, lines = [];
  function finish() { if (key !== null) result.set(key, lines.join('\n').trim()); }
  for (const line of yaml.split(/\r?\n/)) {
    if (line === 'packages:') { inside = true; continue; }
    if (!inside) continue;
    if (line.trim() && !line.startsWith(' ')) break;
    if (/^ {2}\S.*:\s*$/.test(line)) {
      finish();
      key = line.trim().slice(0, -1);
      if ((key.startsWith("'") && key.endsWith("'")) ||
          (key.startsWith('"') && key.endsWith('"'))) key = key.slice(1, -1);
      lines = [line];
    } else if (key !== null) lines.push(line);
  }
  finish();
  if (!result.size) deny('Unrecognized pnpm-lock.yaml');
  return result;
}
export function validateLockUpgrade(oldYaml, newYaml) {
  const previous = parseLock(oldYaml), next = parseLock(newYaml), added = [];
  const priorMajors = new Map();
  for (const key of previous.keys()) {
    const p = packageKey(key);
    if (p) {
      if (!priorMajors.has(p.name)) priorMajors.set(p.name, new Set());
      priorMajors.get(p.name).add(Number(p.version.split('.')[0]));
    }
  }
  for (const [key, block] of previous) {
    if (next.has(key) && block !== next.get(key)) deny('Same-version lock integrity/metadata changed: ' + key);
  }
  for (const key of next.keys()) {
    if (previous.has(key)) continue;
    const p = packageKey(key);
    if (!p || !/^\d+\.\d+\.\d+$/.test(p.version) || p.name === 'xlsx') {
      deny('Non-registry, prerelease, or SheetJS package changed: ' + key);
    }
    const majors = priorMajors.get(p.name);
    if (majors && [...majors].some(x => x !== Number(p.version.split('.')[0]))) {
      deny('Transitive major update: ' + p.name);
    }
    added.push(p);
  }
  if (!added.length || added.length > 100) deny('Lockfile changed unusually; manual review required');
  return added;
}
async function api(path, method = 'GET', payload) {
  if (!process.env.GITHUB_TOKEN) deny('GITHUB_TOKEN missing');
  const response = await fetch('https://api.github.com' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
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
}
async function fileAt(repo, path, sha) {
  const data = await api(repo + '/contents/' + path + '?ref=' + encodeURIComponent(sha));
  if (data.encoding !== 'base64') deny('Unexpected file encoding: ' + path);
  return Buffer.from(data.content, 'base64').toString('utf8');
}
async function changedFiles(repo, number) {
  const files = [];
  for (let page = 1; page <= 4; page++) {
    const result = await api(repo + '/pulls/' + number + '/files?per_page=100&page=' + page);
    files.push(...result);
    if (result.length < 100) break;
  }
  if (!files.length || files.length > 400 || !files.every(x => x.status === 'modified' && ALLOWED.has(x.filename)) ||
      !files.some(x => x.filename === 'package.json') || !files.some(x => x.filename === 'pnpm-lock.yaml')) {
    deny('Only root package.json + pnpm-lock.yaml changes may auto-merge');
  }
}
async function publishedLongEnough(packages) {
  const cache = new Map();
  const deduplicated = [...new Map(packages.map(p => [p.name + '@' + p.version, p])).values()];
  for (const { name, version } of deduplicated) {
    if (!cache.has(name)) {
      const res = await fetch('https://registry.npmjs.org/' + encodeURIComponent(name), {
        headers: { Accept: 'application/json', 'User-Agent': 'trusted-dependabot-delayed-merge' },
      });
      if (!res.ok) deny('npm registry unavailable: ' + name);
      const body = await res.json();
      if (!body.time) deny('Missing npm publish history: ' + name);
      cache.set(name, body.time);
    }
    const published = cache.get(name)[version];
    if (!oldEnough(published)) deny('Published less than 14 days ago or unknown: ' + name + '@' + version);
  }
}
async function allChecksGreen(repo, head) {
  for (const file of WORKFLOWS) {
    const url = repo + '/actions/workflows/' + file + '/runs?head_sha=' + head.sha +
      '&event=pull_request&per_page=30';
    const response = await api(url);
    const runs = (response.workflow_runs ?? []).filter(run =>
      run.head_sha === head.sha && run.head_branch === head.ref &&
      run.event === 'pull_request').sort((a, b) => b.id - a.id);
    if (!runs[0] || runs[0].status !== 'completed' || runs[0].conclusion !== 'success') {
      deny('CI not green: ' + file);
    }
  }
}
async function evaluate(repo, pr) {
  if (pr.user?.login !== 'dependabot[bot]' || pr.draft ||
      pr.base?.ref !== 'main' || pr.head?.repo?.full_name !== process.env.GITHUB_REPOSITORY ||
      !pr.head?.ref?.startsWith('dependabot/npm_and_yarn/') ||
      !oldEnough(pr.created_at) || !oldEnough(pr.updated_at) ||
      pr.mergeable !== true || pr.mergeable_state !== 'clean') {
    deny('Bot, stability, mergeability, or branch condition not satisfied');
  }
  await changedFiles(repo, pr.number);
  const previous = JSON.parse(await fileAt(repo, 'package.json', pr.base.sha));
  const current = JSON.parse(await fileAt(repo, 'package.json', pr.head.sha));
  const direct = validateManifestUpgrade(previous, current);
  const before = await fileAt(repo, 'pnpm-lock.yaml', pr.base.sha);
  const after = await fileAt(repo, 'pnpm-lock.yaml', pr.head.sha);
  const indirect = validateLockUpgrade(before, after);
  await publishedLongEnough([...direct, ...indirect]);
  await allChecksGreen(repo, pr.head);
  const compare = await api(repo + '/compare/' + pr.base.sha + '...' + pr.head.sha);
  if (compare.behind_by !== 0 || compare.ahead_by < 1) deny('PR out of date with main');
  return { sha: pr.head.sha, base: pr.base.sha, updated: pr.updated_at };
}
async function main() {
  const slug = process.env.GITHUB_REPOSITORY ?? '';
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(slug)) deny('Invalid repository');
  const repo = '/repos/' + slug;
  const mainBranch = await api(repo + '/branches/main');
  if (!mainBranch.protected) deny('main requires branch protection + required CI checks before automatic merging');
  const prs = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await api(repo + '/pulls?state=open&per_page=100&page=' + page);
    prs.push(...batch);
    if (batch.length < 100) break;
  }
  for (const pr of prs) {
    if (pr.user?.login !== 'dependabot[bot]') continue;
    try {
      const latest = await api(repo + '/pulls/' + pr.number);
      const approved = await evaluate(repo, latest);
      const fresh = await api(repo + '/pulls/' + pr.number);
      const branch = await api(repo + '/branches/main');
      if (!branch.protected || fresh.state !== 'open' || fresh.head.sha !== approved.sha ||
          fresh.base.sha !== approved.base || fresh.updated_at !== approved.updated) {
        deny('PR changed while evaluating');
      }
      const merge = await api(repo + '/pulls/' + pr.number + '/merge', 'PUT', {
        sha: approved.sha, merge_method: 'squash',
        commit_title: 'chore(deps): merge 14-day mature Dependabot PR #' + pr.number,
      });
      if (!merge.merged) deny('Merge not completed');
      console.log('Merged PR #' + pr.number + ' after all maturity and CI gates');
      break; // Do not merge another PR against stale main/CI.
    } catch (e) {
      console.log('Skipped PR #' + pr.number + ': ' + e.message);
    }
  }
}
if (process.argv[1]?.endsWith('/dependabot-delayed-merge.mjs')) {
  main().catch(e => { console.error(e); process.exitCode = 1; });
}
