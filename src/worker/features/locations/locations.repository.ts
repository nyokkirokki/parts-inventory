import type { Location } from "@shared/types";
import { AppError } from "../../middleware/error-handler";
import type { DbLocationRow } from "../../types";
import { mapLocation } from "../../utils";
import type { LocationWriteInput } from "./locations.schemas";

export class LocationsRepository {
  constructor(private readonly db: D1Database) {}

  async list(): Promise<Location[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM locations ORDER BY code COLLATE NOCASE, name COLLATE NOCASE")
      .all<DbLocationRow>();
    return results.map(mapLocation);
  }

  async create(input: LocationWriteInput): Promise<Location> {
    const row = await this.db
      .prepare("INSERT INTO locations (name, code, description) VALUES (?, ?, ?) RETURNING *")
      .bind(input.name, input.code, input.description ?? null)
      .first<DbLocationRow>();
    if (!row) throw new AppError("LOCATION_CREATE_FAILED", "Failed to create location.", 500);
    return mapLocation(row);
  }

  async update(id: number, input: LocationWriteInput): Promise<Location> {
    const row = await this.db
      .prepare("UPDATE locations SET name = ?, code = ?, description = ?, updated_at = datetime('now') WHERE id = ? RETURNING *")
      .bind(input.name, input.code, input.description ?? null, id)
      .first<DbLocationRow>();
    if (!row) throw new AppError("LOCATION_NOT_FOUND", "Location not found.", 404);
    return mapLocation(row);
  }

  async delete(id: number): Promise<void> {
    const used = await this.db.prepare("SELECT id FROM parts WHERE location_id = ? LIMIT 1").bind(id).first<{ id: number }>();
    if (used) throw new AppError("LOCATION_IN_USE", "This location is used by parts.", 409);

    const result = await this.db.prepare("DELETE FROM locations WHERE id = ?").bind(id).run();
    if (result.meta.changes === 0) throw new AppError("LOCATION_NOT_FOUND", "Location not found.", 404);
  }
}
