# Changelog

## 0.2.0 — 2026-11-21

### Security
- Run the Cloudflare Worker before *all* static asset requests so Basic Auth protects the SPA shell and assets as intended.
- Reject cross-origin/cross-site state-changing API requests using Origin and Fetch Metadata checks; reject non-JSON mutation bodies.
- Neutralize spreadsheet formula-looking strings when exporting CSV, including headers and leading whitespace.
- Upgrade vulnerable SheetJS 0.18.5 to the vendor-maintained 0.20.3 tarball and lock its integrity with pnpm.
- Upgrade Hono, React Router, Zod, and PostCSS; move the Vite React plugin into development dependencies.
- Require the regression CI to fail if production dependency auditing finds HIGH-or-worse advisories.

### Tests
- Add table-driven regressions for Basic Auth boundaries, CSRF, CSV injection, schema limits and coercions, import batch caps, stock changes, stock history and Cloudflare asset routing.
- CI runs with Node 24 and pnpm 10: lint, Web suite, in-process D1 integration suite, TypeScript and production build.
- The new CSV and asset tests were observed failing before fixes, then passing after fixes (red/green proof).

### Outstanding
- Browser and real-deployment penetration tests are separate from in-process CI. Check Cloudflare WAF/rate limits for password-guessing protection.
- CI currently fails on HIGH-or-worse advisories and reports lower severities. Future advisories need triage.
