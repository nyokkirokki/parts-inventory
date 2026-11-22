# 2026-11-22 dependency update quality review

## Scope

This PR combines the previously closed upstream Dependabot proposals #29 (three
production dependencies) and #30 (12 development dependencies), while turning
off unattended merges. No source implementation, API contracts, migration SQL,
remote D1 operation, production deployment or Cloudflare configuration changes.

Direct changes stay within the same major:
- Production: react 19.3.0→19.3.1, react-dom 19.3.0→19.3.1,
  react-router-dom 7.18.4→7.18.6.
- Development: @cloudflare/workers-types, @testing-library/user-event,
  autoprefixer, eslint, eslint-plugin-react-refresh, globals, postcss,
  prettier, typescript-eslint, vite, wrangler, @vitejs/plugin-react
  (versions/diffs in package.json).

Preserved from PR #34: pnpm 10.34.9 and the reviewed SheetJS vendor tarball
SHA-512. The combined lockfile was regenerated using the pinned pnpm with
`--ignore-scripts --lockfile-only --fix-lockfile --no-frozen-lockfile`, then
the original approved SheetJS hash was restored via the strict opt-in repair
command. A check found **no changed integrity hashes on packages whose exact
package/version keys existed before the update**. The checked-in lockfile
subsequently passed `pnpm install --frozen-lockfile` without any regeneration
step in the committed CI.

## Regression results (disposable fork PR CI)

Validation PR: https://github.com/s-soya2421/parts-inventory/pull/10
(temporary validation PR only; do not merge it).
- CI: lint (0 errors, 34 warnings), TypeScript typecheck, production build,
  web unit tests **158 passed**, SQL-backed integration tests **156 passed**.
- Security/regression: passed, including the high-severity production audit.
- Local disposable D1 migrations and backup/restore integrity: passed.
- Chromium E2E: **20/20 passed** (10 scenarios on desktop, same 10 on mobile).
- Vendor SHA-512 pre-install check and standalone checker tests (7): passed.

New browser regressions specifically added for this dependency upgrade:
1. React Router deep links, browser Back/Forward, reload, and project-form route.
2. Project/BOM creation and editing, part selection, correct price totals,
   and confirmation that BOM operations do **not** change inventory stock.
Both scenarios run on desktop and mobile Chromium.

Existing browser regressions cover Basic Auth for SPA/API/static assets,
responsive navigation, inventory create/edit with nullable prices, stock
changes and negative-stock validation, parts search, JSON import and undo,
JSON export, and unknown API 404 responses. Integration tests cover
concurrent stock updates, atomicity, import/undo conflict protection, category
and typed-attribute consistency, security, and project/DB behavior.

## Quality-review findings and residual risks

- **Lockfile combining failure caught and corrected:** copying two separately
  generated Dependabot lockfiles left missing peer-resolution entries. Frozen
  install rejected it. We regenerated a valid combined lockfile using the
  repository's pinned pnpm, and the final frozen install passed.
- **Transitive majors despite same-major direct updates:** `minimatch` 10→11
  (used by ESLint/type tooling), and optional
  `@emnapi/runtime` 2.0.0-beta.2 alongside 1.x (WASM/native tooling).
  Their use is build/dev-oriented and the current CI passes, but this is still
  a meaningful supply-chain/compatibility change. Human review is required.
- **Not comprehensive:** these checks do not exercise real production traffic,
  all import/export file formats in a browser, category settings UI end-to-end,
  Firefox/WebKit/Safari, unusual devices, or high-volume multi-client behavior
  in a real Cloudflare environment. Staging/manual smoke checks should precede
  any separately authorized production release.
- **Unattended merge removal:** the scheduled GitHub Actions auto-merge
  workflow and its write-capable helper were deleted; a web regression guard
  now fails if that workflow/script reappears. Dependabot continues proposing
  PRs. Repository settings or third-party bots that might independently
  enable auto-merging cannot be switched off by this repository-only change.
  The owner should confirm **Settings → General → Pull Requests → Allow auto-merge**
  is off, as well as any external automation.
- GitHub Actions PR validation and Cloudflare preview (if configured) are
  separate from a production release. This PR contains no remote D1 write,
  migration, restore, or deployment commands.

## Merge recommendation

**Manual review only.** Check the exact diff, compare the two transitive major
changes against release notes/advisories, verify all four CI workflows remain
green at the final PR head SHA, and approve the repository-wide auto-merge
setting before merging. CI is strong for the current dependency scope, but not
proof against every regression or supply-chain compromise.
