import type { PartStatus } from "@shared/types";
import { AppError } from "../../middleware/error-handler";
import type { DbPartStatusRow } from "../../types";
import { mapPartStatus, slugify } from "../../utils";
import type { StatusWriteInput } from "./statuses.schemas";

const DEFAULT_COLOR = "#64748b";

export class StatusesRepository {
  constructor(private readonly db: D1Database) {}

  async list(): Promise<PartStatus[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM part_statuses ORDER BY sort_order, name COLLATE NOCASE")
      .all<DbPartStatusRow>();
    return results.map(mapPartStatus);
  }

  async findById(id: number): Promise<PartStatus | null> {
    const row = await this.db.prepare("SELECT * FROM part_statuses WHERE id = ?").bind(id).first<DbPartStatusRow>();
    return row ? mapPartStatus(row) : null;
  }

  async create(input: StatusWriteInput): Promise<PartStatus> {
    const slug = input.slug ?? slugify(input.name);
    const row = await this.db
      .prepare(
        "INSERT INTO part_statuses (name, slug, color, sort_order) VALUES (?, ?, ?, ?) RETURNING id, name, slug, color, sort_order, created_at, updated_at",
      )
      .bind(input.name, slug, input.color ?? DEFAULT_COLOR, input.sortOrder ?? 0)
      .first<DbPartStatusRow>();
    if (!row) throw new AppError("STATUS_CREATE_FAILED", "Failed to create status.", 500);
    return mapPartStatus(row);
  }

  async update(id: number, input: StatusWriteInput): Promise<PartStatus> {
    const slug = input.slug ?? slugify(input.name);
    const row = await this.db
      .prepare(
        `UPDATE part_statuses
         SET name = ?, slug = ?, color = COALESCE(?, color), sort_order = COALESCE(?, sort_order), updated_at = datetime('now')
         WHERE id = ?
         RETURNING id, name, slug, color, sort_order, created_at, updated_at`,
      )
      .bind(input.name, slug, input.color ?? null, input.sortOrder ?? null, id)
      .first<DbPartStatusRow>();
    if (!row) throw new AppError("STATUS_NOT_FOUND", "Status not found.", 404);
    return mapPartStatus(row);
  }

  async delete(id: number): Promise<void> {
    const result = await this.db.prepare("DELETE FROM part_statuses WHERE id = ?").bind(id).run();
    if (result.meta.changes === 0) throw new AppError("STATUS_NOT_FOUND", "Status not found.", 404);
  }
}
