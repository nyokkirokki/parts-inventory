import { Hono } from "hono";
import { errorHandler } from "./middleware/error-handler";
import { requireBasicAuth } from "./middleware/basic-auth";
import { requestLogger } from "./middleware/request-logger";
import { rejectCrossSiteMutations } from "./middleware/csrf-guard";
import { categoriesRoutes } from "./features/categories/categories.routes";
import { exportRoutes } from "./features/export/export.routes";
import { importRoutes } from "./features/import/import.routes";
import { locationsRoutes } from "./features/locations/locations.routes";
import { partsRoutes } from "./features/parts/parts.routes";
import { projectsRoutes } from "./features/projects/projects.routes";
import { statusesRoutes } from "./features/statuses/statuses.routes";
import { tagsRoutes } from "./features/tags/tags.routes";
import type { Env } from "./types";

export const app = new Hono<Env>();

app.onError(errorHandler);
app.use("/api/*", requestLogger);
app.use("*", requireBasicAuth);
app.use("/api/*", rejectCrossSiteMutations);

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "electronics-inventory",
    timestamp: new Date().toISOString(),
  }),
);

app.route("/api/parts", partsRoutes);
app.route("/api/categories", categoriesRoutes);
app.route("/api/locations", locationsRoutes);
app.route("/api/tags", tagsRoutes);
app.route("/api/projects", projectsRoutes);
app.route("/api/statuses", statusesRoutes);
app.route("/api/import", importRoutes);
app.route("/api/export", exportRoutes);

app.notFound(async (c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: { code: "NOT_FOUND", message: "Unknown API route." } }, 404);
  }
  if (c.env.ASSETS) {
    const response = await c.env.ASSETS.fetch(c.req.raw);
    if (response.status !== 404) return response;

    // Deep-linked SPA pages are only served AFTER Worker Basic Auth succeeds.
    // The built-in asset SPA fallback can turn an authentication 401 into
    // a 200 HTML response in the local/production assets pipeline.
    if (c.req.method === "GET" && c.req.header("accept")?.includes("text/html")) {
      const indexUrl = new URL("/index.html", c.req.url);
      return c.env.ASSETS.fetch(new Request(indexUrl, {
        method: "GET",
        headers: c.req.raw.headers,
      }));
    }
    return response;
  }
  return c.json({ error: { code: "NOT_FOUND", message: "Route not found." } }, 404);
});
