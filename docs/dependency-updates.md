# Dependency update policy: proposals only, manual merges

## Current policy

Dependabot continues to create weekly **pull requests** for root pnpm dependencies, browser E2E tooling, and GitHub Actions. **No PR is automatically merged**. The former `.github/workflows/dependabot-delayed-merge.yml` scheduled/manual auto-merger and its write-capable merge script have been removed. The branch protection, reviews, and required CI checks must stay enabled.

| Area | PR generation | Merge responsibility |
| --- | --- | --- |
| Root pnpm production & development patch/minor | Monday at 09:00 JST | Human-reviewed, manual |
| E2E tool dependencies | Monday at 09:30 JST | Human-reviewed, manual |
| GitHub Actions | Monday at 10:00 JST | Human-reviewed, manual |
| Major upgrades, prerelease and 0.x changes | Proposed when Dependabot finds them | Explicit compatibility review, manual |
| SheetJS vendor CDN tarball | Version proposal excluded | Dedicated security review |

This PR removes only GitHub's repository-provided unattended merge workflow. Repository-level GitHub auto-merge settings, outside bots, or external apps must also remain disabled if present. Review **Settings → General → Pull Requests → Allow auto-merge**, and any external automations. Keep Dependabot security alerts and PR proposals enabled.

## Manual change review checklist

1. Confirm only approved direct dependencies and intended transitive dependencies changed. Do not accept altered scripts, unfamiliar registries, unexpected major updates, integrity removal, or new postinstall hooks without review.
2. Check that `package.json` and `pnpm-lock.yaml` agree, and that the SheetJS CDN SHA-512 entry remains unchanged. All CI workflows verify it **before installing**.
3. Ensure `pnpm install --frozen-lockfile` passes with the pinned `packageManager` version, then lint, typecheck, unit, SQL-backed integration, advisory audit, SPA build, Chromium desktop/mobile E2E, and local D1 backup/restore all pass.
4. Review UI behavior for authentication, inventory create/edit, stock edits, search, imports and undo, JSON export, project/BOM pricing and archiving. Test dependency-specific behaviors (e.g. React DOM rendering and routing) as needed.
5. Read new release notes and resolved advisories. Consider a manual observation period for new versions, especially where package provenance and ecosystem availability are uncertain.
6. Merge only after human approval. Treat production deployment and remote D1 changes as a **separate** release action. Never run remote D1 migrate/export/restore or Cloudflare deployment as part of dependency-update CI.

### What CI covers and does not cover

CI protects listed regressions and runs a disposable SQLite/D1 environment, not production. A passing build does not guarantee all browser interactions, unusual devices, non-Chromium browsers, data volumes, or real-user edge cases are safe. Continue staging validation before high-impact dependency changes and monitor after the separately approved release.

## SheetJS vendor tarball integrity: pre-install gate and manual repair

Dependabot currently rewrites the external SheetJS xlsx `0.20.3` tarball lock entry
without its previously approved SHA-512 `integrity` field while updating unrelated
packages (seen in upstream PRs #29–#33). A matching pnpm lockfile rewrite was
reported upstream. **A missing hash alone is not evidence of a compromised
tarball**, but never install or merge such a lockfile without restoring the
approved integrity value.

All four verification workflows now invoke this dependency-free, built-in Node
check **before** running `pnpm install`:

```sh
node scripts/sheetjs-integrity.mjs
node --test tests/sheetjs-integrity.test.mjs
```

The check validates the pinned vendor URL, lockfile entry, expected xlsx version,
and **exact previously committed** SHA-512. A missing or different checksum,
unexpected URL, duplicate xlsx entry, or altered metadata blocks installation.

**Manual recovery on a Dependabot PR branch (never automatic CI mutation):**

1. Read the PR's full dependency and lockfile diff. Confirm there are no unknown
   sources, scripts, or unrelated changes.
2. If and only if the **sole** SheetJS resolution change is that the checksum
   disappeared while the vendor tarball URL and version stayed the same, run:
   `node scripts/sheetjs-integrity.mjs --repair`
3. Inspect `git diff -- pnpm-lock.yaml`. The repair must restore only the known
   `integrity` field. The command refuses a changed checksum, source, version,
   or resolution shape rather than overwriting it.
4. Re-run the pre-install gate, then `pnpm install --frozen-lockfile`, full
   lint/typecheck/unit/integration tests, Chromium E2E and local D1 restore CI.
5. Re-review the PR and get explicit human approval. No automatic merge is allowed; major updates remain separately reviewed.

This is a **metadata guard**, not proof that the actual tarball is safe; pnpm must
still verify the downloaded bytes against the pinned SHA-512, and provenance
and dependencies need their own review. The approved checksum was copied from
the repository's established lockfile, **not recalculated from a potentially
compromised remote download**. The checker does not fix a possibly compromised
package, relax the lockfile security tests, merge PRs, deploy to Cloudflare, or
touch remote D1.

The other upstream PRs are intentionally left independent: #31 (Tailwind 3→4)
also breaks the PostCSS build and requires a separate migration; #32 and #33
are major test-tool upgrades requiring explicit compatibility review.
