# Dependency update policy

## Goal

Keep `parts-inventory` dependencies current without silently changing the running application or its data. Dependabot **proposes pull requests**; it does not merge, deploy, run remote D1 migrations, or restore a database.

## Automated proposals

The configuration lives in `.github/dependabot.yml` and becomes active **in the repository where it is merged to the default branch**.

| Area | Schedule (JST) | Update handling |
| --- | --- | --- |
| Root pnpm app (`package.json` and `pnpm-lock.yaml`) | Monday 09:00 | Group production and development minor/patch updates separately; leave major updates as individual PRs |
| Browser E2E runner (`e2e/package.json`) | Monday 09:30 | Group minor/patch updates; leave major updates as individual PRs |
| GitHub Actions | Monday 10:00 | Open reviewable PRs for action version updates |

Dependabot's version-update PR limit is 5 for the app, 2 for E2E, and 3 for Actions. Vulnerability-driven security PRs are a separate feature: enable **Dependabot alerts** and **Dependabot security updates** in the upstream repository's security settings if they are not already enabled.

`xlsx` is deliberately excluded from automated version updates. It is pinned to an official SheetJS CDN tarball, not an npm registry release. Check SheetJS security and release notices manually; never substitute the known-outdated npm package to make an update pass.

## Review and release gates

1. Review the Dependabot diff, changelog, dependency source, and `pnpm-lock.yaml`; avoid accepting unexpectedly broad dependency changes.
2. Require the existing PR checks to pass: **CI**, **Security and regression CI**, **Headless browser E2E (Chromium + D1)**, and **Disposable D1 backup and restore verification**. They test against local/disposable D1, not the production database.
3. For runtime, Wrangler, React Router, or major-version updates, review breaking changes and critical paths (login/logout, listing/search, import, export, revert, and backup) in addition to green CI.
4. Merge only after human review. A green CI run is necessary but not sufficient for production safety; it cannot guarantee the absence of regressions.
5. Keep production deployment, remote D1 migrations, and restore operations separate and manually approved. Follow `docs/operations.md` and `docs/disaster-recovery.md`, including backup/recovery checks before DB-changing releases.

## Before considering future auto-merge

As of 2026-11-21, upstream `main` has **no branch protection or required status checks**. This PR intentionally adds **no auto-merge workflow**.

The repository owner should first configure a branch ruleset for `main` requiring the relevant CI, security, browser E2E, and backup-restore checks, preventing direct bypasses, and enforcing up-to-date checks as appropriate. Verify those rules against real PRs before contemplating a tightly scoped patch-only auto-merge policy. Even then, do not auto-merge major updates, application code, Worker/Cloudflare configuration, D1 schema migrations, or deployment changes.

No Cloudflare deployment automation is introduced here. An independently configured Git integration might deploy after merges to `main`, so review that setting separately before enabling any automated merge.
