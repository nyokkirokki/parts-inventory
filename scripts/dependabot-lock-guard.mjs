// Conservative pnpm v9 lockfile policy. Any unrecognized shape fails closed.
// Not a general YAML parser: pnpm install --frozen-lockfile also runs in CI.
function reject(reason) { throw new Error(reason); }

function topLevel(yaml) {
  if (typeof yaml !== 'string' || !yaml.startsWith("lockfileVersion: '9.0'")) reject('Unsupported lockfile version');
  const result = new Map();
  let current = null;
  for (const line of yaml.replace(/\r\n/g, '\n').split('\n')) {
    const header = /^([a-zA-Z][a-zA-Z0-9-]*):(?:\s*(.*))?$/.exec(line);
    if (header) {
      current = header[1];
      if (result.has(current)) reject('Duplicate lockfile section');
      result.set(current, [line]);
    } else if (current) {
      result.get(current).push(line);
    } else if (line.trim()) reject('Unexpected lockfile preamble');
  }
  if (['lockfileVersion', 'settings', 'overrides', 'importers', 'packages', 'snapshots'].join() !==
      [...result.keys()].join()) reject('Lockfile sections changed');
  return result;
}

function entries(section, depth) {
  const map = new Map();
  const expression = new RegExp('^ {' + depth + "}(?:'([^']+)'|\"([^\"]+)\"|([^:]+)):(.*)$");
  let current;
  for (const line of section.slice(1)) {
    const match = expression.exec(line);
    if (match) {
      current = match[1] ?? match[2] ?? match[3];
      if (map.has(current)) reject('Duplicate entry ' + current);
      map.set(current, [line]);
    } else if (line.trim() && (!current || line.match(/^ */)[0].length <= depth)) {
      reject('Malformed lockfile entry');
    } else if (current) map.get(current).push(line);
  }
  return new Map([...map].map(([name, block]) => [name, block.join('\n').trimEnd()]));
}

function innerSections(importer) {
  const map = new Map();
  let current;
  for (const line of importer.split('\n').slice(1)) {
    const match = /^ {4}([a-zA-Z][a-zA-Z0-9]*):\s*$/.exec(line);
    if (match) {
      current = match[1];
      if (map.has(current)) reject('Duplicate importer field');
      map.set(current, [line]);
    } else if (line.trim() && (!current || line.match(/^ */)[0].length <= 4)) {
      reject('Unrecognized importer data');
    } else if (current) map.get(current).push(line);
  }
  return map;
}

function importerDependencies(lines) {
  if (!lines) return new Map();
  const result = new Map();
  let name, content = [];
  function finish() {
    if (name === undefined) return;
    const specifier = content.find(x => /^ {8}specifier: /.test(x))?.trim().slice(11);
    const version = content.find(x => /^ {8}version: /.test(x))?.trim().slice(9);
    if (!specifier || !version || content.filter(x => x.trim()).length !== 2) reject('Unexpected importer dependency details');
    result.set(name, { specifier, version });
  }
  for (const line of lines.slice(1)) {
    const m = /^ {6}(?:'([^']+)'|"([^"]+)"|([^:]+)):\s*$/.exec(line);
    if (m) {
      finish();
      name = m[1] ?? m[2] ?? m[3];
      if (result.has(name)) reject('Duplicate importer dependency');
      content = [];
    } else if (line.trim() && (!name || line.match(/^ */)[0].length <= 6)) reject('Malformed importer dependency');
    else if (name) content.push(line);
  }
  finish();
  return result;
}

function packageKey(key) {
  const m = /^(.+)@(\d+\.\d+\.\d+)(?:\((.+)\))?$/.exec(key);
  return m ? { name: m[1], version: m[2] } : null;
}
function semver(v) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(v ?? '');
  return match ? match.slice(1).map(Number) : null;
}
function notDowngrade(from, to) {
  for (let i = 0; i < 3; i++) {
    if (to[i] !== from[i]) return to[i] > from[i];
  }
  return true;
}
function resolvedVersion(value) {
  const match = /^(\d+\.\d+\.\d+)(?:\(.+\))?$/.exec(value ?? '');
  return match?.[1] ?? null;
}
function compareImporter(before, after, beforeManifest, afterManifest) {
  const oldDeps = innerSections(before), newDeps = innerSections(after);
  if ([...oldDeps.keys()].join() !== [...newDeps.keys()].join()) reject('Importer fields added, removed or reordered');
  for (const [field, lines] of oldDeps) {
    if (!['dependencies', 'devDependencies'].includes(field)) {
      if (lines.join('\n') !== newDeps.get(field).join('\n')) reject('Unrelated importer change');
      continue;
    }
    const oldMap = importerDependencies(lines), newMap = importerDependencies(newDeps.get(field));
    if ([...oldMap.keys()].join() !== [...newMap.keys()].join()) reject('Importer dependency list changed');
    for (const [name, oldEntry] of oldMap) {
      const next = newMap.get(name);
      if (!next) reject('Importer dependency removed');
      if (oldEntry.specifier !== beforeManifest[field]?.[name] ||
          next.specifier !== afterManifest[field]?.[name]) reject('Importer specifier does not match package.json');
      if (oldEntry.specifier === next.specifier && oldEntry.version === next.version) continue;
      if (oldEntry.specifier === next.specifier && oldEntry.version !== next.version) {
        // Peer resolution may change in another dependency's upgrade.
        // Direct package itself must remain at the same major.
        const a = semver(resolvedVersion(oldEntry.version)), b = semver(resolvedVersion(next.version));
        if (!a || !b || a[0] !== b[0] || !notDowngrade(a, b)) reject('Unsafe peer dependency resolution change');
        continue;
      }
      const oldVer = semver(resolvedVersion(oldEntry.version));
      const newVer = semver(resolvedVersion(next.version));
      if (!oldVer || !newVer || oldVer[0] === 0 || oldVer[0] !== newVer[0] ||
          !notDowngrade(oldVer, newVer)) reject('Unsafe direct resolved major or downgrade');
    }
  }
}

export function parseLock(yaml) {
  return entries(topLevel(yaml).get('packages'), 2);
}

export function validateLockUpgrade(beforeYaml, afterYaml, oldManifest, newManifest) {
  const a = topLevel(beforeYaml), b = topLevel(afterYaml);
  for (const section of ['lockfileVersion', 'settings', 'overrides']) {
    if (a.get(section).join('\n').trimEnd() !== b.get(section).join('\n').trimEnd()) {
      reject('Lockfile metadata changed: ' + section);
    }
  }
  const oldImporters = entries(a.get('importers'), 2);
  const newImporters = entries(b.get('importers'), 2);
  if ([...oldImporters.keys()].join() !== [...newImporters.keys()].join() ||
      !oldImporters.has('.')) reject('Unexpected importer layout');
  for (const [name, oldBlock] of oldImporters) {
    if (name !== '.') {
      if (oldBlock !== newImporters.get(name)) reject('Non-root importer changed');
    } else if (oldManifest && newManifest) {
      compareImporter(oldBlock, newImporters.get(name), oldManifest, newManifest);
    } else if (oldBlock !== newImporters.get(name)) {
      // Without manifests the only permitted change is none; fail closed.
      reject('Importer changed without trusted manifests');
    }
  }

  const oldPackages = entries(a.get('packages'), 2), newPackages = entries(b.get('packages'), 2);
  const oldSnapshots = entries(a.get('snapshots'), 2), newSnapshots = entries(b.get('snapshots'), 2);
  if (!oldPackages.size || !newPackages.size || !oldSnapshots.size || !newSnapshots.size) reject('Missing lock entries');

  const oldMajors = new Map();
  for (const key of oldPackages.keys()) {
    const p = packageKey(key);
    if (p) {
      if (!oldMajors.has(p.name)) oldMajors.set(p.name, new Set());
      oldMajors.get(p.name).add(Number(p.version.split('.')[0]));
    }
  }
  const added = [];
  for (const [key, raw] of oldPackages) {
    if (newPackages.has(key) && raw !== newPackages.get(key)) reject('Existing package metadata or integrity changed: ' + key);
  }
  for (const [key, raw] of newPackages) {
    if (oldPackages.has(key)) continue;
    const p = packageKey(key);
    if (!p || p.name === 'xlsx') reject('Unrecognized new registry package ' + key);
    if (oldMajors.has(p.name) && [...oldMajors.get(p.name)].some(x => x !== Number(p.version.split('.')[0]))) {
      reject('Transitive major upgrade: ' + p.name);
    }
    if (!/resolution: \{integrity: sha512-[A-Za-z0-9+/=]+\}/.test(raw)) reject('Missing sha512 integrity: ' + key);
    added.push(p);
  }
  for (const [key, raw] of oldSnapshots) {
    if (newSnapshots.has(key) && raw !== newSnapshots.get(key)) reject('Existing snapshot changed: ' + key);
  }
  for (const key of newSnapshots.keys()) {
    if (oldSnapshots.has(key)) continue;
    const p = packageKey(key);
    if (!p) reject('Unrecognized snapshot: ' + key);
    const pkgKey = p.name + '@' + p.version;
    if (!newPackages.has(pkgKey)) reject('Snapshot without registry package: ' + key);
    added.push(p);
  }
  if (!added.length || added.length > 200) reject('No registry changes or too many lock changes');
  return [...new Map(added.map(x => [x.name + '@' + x.version, x])).values()];
}
