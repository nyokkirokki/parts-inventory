import { createMiddleware } from "hono/factory";
import type { Env } from "../types";

const MUTATIONS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const JSON_CONTENT_TYPE = /^application\/json(?:\s*;|$)/i;

/**
 * Mitigates cross-site writes authenticated by automatically attached Basic credentials.
 * Browser Origin/Fetch Metadata headers cannot be forged by cross-origin JS/forms.
 * Requests without browser headers are permitted for command-line API clients.
 */
export const rejectCrossSiteMutations = createMiddleware<Env>(async (c, next) => {
  if (!MUTATIONS.has(c.req.method)) return next();

  const site = c.req.header("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return c.json({ error: { code: "CROSS_SITE_REQUEST", message: "Cross-site mutations are not permitted." } }, 403);
  }

  const origin = c.req.header("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(c.req.url).origin) {
        return c.json({ error: { code: "INVALID_ORIGIN", message: "Cross-origin mutations are not permitted." } }, 403);
      }
    } catch {
      return c.json({ error: { code: "INVALID_ORIGIN", message: "Invalid Origin header." } }, 403);
    }
  }

  const contentType = c.req.header("content-type");
  if (contentType && !JSON_CONTENT_TYPE.test(contentType)) {
    return c.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "JSON request content type required." } }, 415);
  }

  await next();
});
