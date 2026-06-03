import type { Tag } from "@shared/types";
import { AppError } from "../../middleware/error-handler";
import type { DbTagRow } from "../../types";
import { mapTag, slugify } from "../../utils";
import type { TagWriteInput } from "./tags.schemas";

export class TagsRepository {
  constructor(private readonly db: D1Database) {}

  async list(): Promise<Tag[]> {
    const { results } = await this.db.prepare("SELECT * FROM tags ORDER BY name COLLATE NOCASE").all<DbTagRow>();
    return results.map(mapTag);
  }

  async findById(id: number): Promise<Tag | null> {
    const row = await this.db.prepare("SELECT * FROM tags WHERE id = ?").bind(id).first<DbTagRow>();
    return row ? mapTag(row) : null;
  }

  async create(input: TagWriteInput): Promise<Tag> {
    const slug = input.slug ?? slugify(input.name);
    const row = await this.db
      .prepare("INSERT INTO tags (name, slug) VALUES (?, ?) RETURNING id, name, slug, created_at, updated_at")
      .bind(input.name, slug)
      .first<DbTagRow>();
    if (!row) throw new AppError("TAG_CREATE_FAILED", "Failed to create tag.", 500);
    return mapTag(row);
  }

  async ensureByName(name: string): Promise<Tag> {
    const slug = slugify(name);
    const existing = await this.db.prepare("SELECT * FROM tags WHERE slug = ?").bind(slug).first<DbTagRow>();
    if (existing) return mapTag(existing);
    return this.create({ name, slug });
  }

  async update(id: number, input: TagWriteInput): Promise<Tag> {
    const slug = input.slug ?? slugify(input.name);
    const row = await this.db
      .prepare(
        "UPDATE tags SET name = ?, slug = ?, updated_at = datetime('now') WHERE id = ? RETURNING id, name, slug, created_at, updated_at",
      )
      .bind(input.name, slug, id)
      .first<DbTagRow>();
    if (!row) throw new AppError("TAG_NOT_FOUND", "Tag not found.", 404);
    return mapTag(row);
  }

  async delete(id: number): Promise<void> {
    const result = await this.db.prepare("DELETE FROM tags WHERE id = ?").bind(id).run();
    if (result.meta.changes === 0) throw new AppError("TAG_NOT_FOUND", "Tag not found.", 404);
  }
}
