# Dependency update and delayed auto-merge policy

## Scope

Dependabot opens weekly dependency PRs from `.github/dependabot.yml`. A separate scheduled workflow may **squash-merge eligible root pnpm patch/minor updates only after a 14-day cooling-off period**. It never runs PR code with write privileges and never performs production deploys, Cloudflare changes, or remote D1 operations.

### Weekly PR creation (JST)

| Area | Schedule | Merge |
| --- | --- | --- |
| Root pnpm app | Monday 09:00 | Root package.json + pnpm-lock.yaml changes can auto-merge only after all gates |
| Browser E2E dependencies | Monday 09:30 | Manual (no committed lockfile currently; cannot verify transitive ages) |
| GitHub Actions | Monday 10:00 | Manual |
| Major updates, prerelease, 0.x, lockfile-only changes | When offered | Manual |
| SheetJS official CDN tarball | Excluded from version updates | Manual security/release review |

Dependabot's limits are 5 root PRs, 2 E2E PRs, 3 Actions PRs. Major upgrades remain proposed for human review, not automatically merged.

### Safe auto-merge gates

`.github/workflows/dependabot-delayed-merge.yml` runs daily at 12:17 JST (GitHub schedules may be delayed) and invokes `scripts/dependabot-delayed-merge.mjs` from the **trusted main branch**. Its unit tests run on every PR via CI.

All must be satisfied or the update is left for human review:

1. The upstream repository's `main` branch is **protected**. Before protection is enabled, automation intentionally fails closed.
2. PR is authored by `dependabot[bot]`, from the same repository's `dependabot/npm_and_yarn/` branch, targets `main`, is not a draft, and is cleanly mergeable.
3. PR was opened **at least 14 days ago**, and **not updated in the last 14 days**. A newly updated PR waits again.
4. PR changes **only** the existing root `package.json` and `pnpm-lock.yaml`. Changes to scripts, package manager, overrides, added dependencies, other source files, E2E, or GitHub Actions are never auto-merged.
5. Direct dependency changes are stable, parseable semver within the same major version, strictly increasing; versions below 1.0 and unsupported version formats go to review.
6. The pnpm lockfile is parsable, unchanged-package integrity/metadata is not modified, and no existing transitive package name changes major version. New packages with unsupported versions fail closed.
7. **Every new direct and lockfile package version** must have an npm registry publication timestamp at least **14 days old**. Missing registry metadata or errors block merging. This limits exposure to brand-new compromised releases, but cannot prove safety.
8. All four latest CI workflow runs for the precise PR head SHA must have succeeded: `ci.yml`, `security-regression.yml`, `browser-e2e.yml`, `backup-restore.yml`.
9. The PR must be up to date with `main`; the script verifies SHA and PR state again just before GitHub's merge API call. It merges at most **one PR per daily run**, and uses a SHA-guarded squash merge.

Failures are logged as skipped; **no force merge and no bypass of failed checks**. A vulnerability/security alert requiring urgent remediation should be assessed and merged manually, not left to the 14-day waiting policy.

### Required one-time owner setup

After merging the workflow PR:

1. Visit [repository rulesets](https://github.com/nyokkirokki/parts-inventory/settings/rules) and add an **active branch ruleset for `main`**. Require a pull request and the four CI check contexts (select actual job check names seen in a successful PR: `Lint, test, and build`, `verify` from Security and regression CI, `Chromium desktop + mobile`, `Complete SQL backup round trip (local D1 only)`). Require checks to pass, prevent bypass, and consider up-to-date branch verification. Ensure approval requirements are compatible with bot merges; the workflow will not fabricate approvals. Check the ruleset really makes `GET /branches/main` report `protected=true` before trusting automation.
2. Visit [Actions settings](https://github.com/nyokkirokki/parts-inventory/settings/actions) and verify Actions are enabled and the scheduled workflow's `GITHUB_TOKEN` has the permissions needed for merges. The workflow explicitly requests `contents: write`, `pull-requests: write`, and `actions: read`. If organization/repository policy disallows these, it will fail closed; do **not** use a broad personal access token without another review.
3. Visit [security settings](https://github.com/nyokkirokki/parts-inventory/settings/security_analysis) and enable **Dependabot alerts** and **Dependabot security updates** if disabled.
4. Visit [workflow runs](https://github.com/nyokkirokki/parts-inventory/actions/workflows/dependabot-delayed-merge.yml) and use **Run workflow** to verify it executes. It must not merge any PR younger than 14 days.
5. Confirm Cloudflare Git integrations or other deployment jobs do not automatically deploy merged dependency PRs if you require separate release approval. GitHub Actions workflow itself has **no deploy step**.

### Limitations and escalation

Waiting 14 days provides observation time, not a proof of safety. Npm accounts or older releases can still be compromised; a green CI does not guarantee no regressions. Consider provenance/signature verification, stricter package trust policy, audit history, and production monitoring in a later security iteration.

**No unattended production deployment, D1 migration, or database restore** is introduced. Follow `docs/operations.md` and `docs/disaster-recovery.md` before separately approving releases with DB implications.

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
5. Re-review the PR; the ordinary 14-day cooling-off rule still applies to
   eligible minor/patch automation, and major updates remain manual.

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
