import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../../db/client";
import type { Env } from "../../types";
import { PartsRepository, type PartListFilters } from "../parts/parts.repository";
import { ExportService, type ExportFormat, type JsonMode } from "./export.service";

export const exportRoutes = new Hono<Env>();

const exportQuerySchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  categorySlug: z.string().trim().min(1).optional(),
  format: z.enum(["excel", "pdf", "json", "csv"]).default("json"),
  mode: z.enum(["flat", "raw"]).default("flat"),
});

exportRoutes.get("/parts", async (c) => {
  const params = new URL(c.req.url).searchParams;
  const query = exportQuerySchema.parse({
    categoryId: params.get("categoryId") || undefined,
    categorySlug: params.get("categorySlug") || undefined,
    format: params.get("format") || undefined,
    mode: params.get("mode") || undefined,
  });
  const filters: PartListFilters = {
    categoryId: query.categoryId,
    categorySlug: query.categorySlug,
  };
  const format = query.format as ExportFormat;
  const jsonMode = query.mode as JsonMode;
  const service = new ExportService(new PartsRepository(getDb(c.env)));

  return service.exportParts(filters, format, jsonMode);
});
