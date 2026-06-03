// A faithful-enough D1Database adapter backed by Node's built-in `node:sqlite`
// (DatabaseSync, available in Node 24+). The Cloudflare workerd runtime cannot
// start on this machine (workerd.exe fails with STATUS_DLL_NOT_FOUND, 0xC0000135),
// so `@cloudflare/vitest-pool-workers` and wrangler `unstable_dev` are both
// unusable here. Driving the real Hono app against a real SQLite DB through this
// adapter still exercises the genuine route -> service -> repository -> SQL path.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

type Bindable = string | number | null | bigint;

// D1 binds JS booleans/undefined; node:sqlite only accepts null/number/bigint/string/Uint8Array.
function coerce(value: unknown): Bindable {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number" || typeof value === "string" || typeof value === "bigint") return value;
  return String(value);
}

class PreparedStatement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly params: Bindable[] = [],
  ) {}

  bind(...params: unknown[]): PreparedStatement {
    return new PreparedStatement(this.db, this.sql, params.map(coerce));
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const stmt = this.db.prepare(this.sql);
    const row = stmt.get(...this.params);
    return (row as T | undefined) ?? null;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: true; meta: D1Meta }> {
    const stmt = this.db.prepare(this.sql);
    const results = stmt.all(...this.params) as T[];
    return { results, success: true, meta: emptyMeta() };
  }

  async run(): Promise<{ results: never[]; success: true; meta: D1Meta }> {
    const stmt = this.db.prepare(this.sql);
    const info = stmt.run(...this.params);
    return {
      results: [],
      success: true,
      meta: { ...emptyMeta(), changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) },
    };
  }

  // Used internally by batch(); also satisfies the D1 surface.
  async raw(): Promise<unknown[]> {
    const stmt = this.db.prepare(this.sql);
    return stmt.all(...this.params) as unknown[];
  }

  // Expose for batch execution.
  _execute() {
    const stmt = this.db.prepare(this.sql);
    const isWrite = /^\s*(insert|update|delete|create|drop|alter|replace)/i.test(this.sql);
    if (isWrite && !/returning/i.test(this.sql)) {
      const info = stmt.run(...this.params);
      return {
        results: [],
        success: true as const,
        meta: { ...emptyMeta(), changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) },
      };
    }
    const results = stmt.all(...this.params);
    return { results, success: true as const, meta: emptyMeta() };
  }
}

type D1Meta = {
  duration: number;
  size_after: number;
  rows_read: number;
  rows_written: number;
  changes: number;
  last_row_id: number;
  changed_db: boolean;
};

function emptyMeta(): D1Meta {
  return {
    duration: 0,
    size_after: 0,
    rows_read: 0,
    rows_written: 0,
    changes: 0,
    last_row_id: 0,
    changed_db: false,
  };
}

export class SqliteD1 {
  constructor(private readonly db: DatabaseSync) {}

  prepare(sql: string): PreparedStatement {
    return new PreparedStatement(this.db, sql);
  }

  async batch(statements: PreparedStatement[]): Promise<Array<{ results: unknown[]; success: true; meta: D1Meta }>> {
    this.db.exec("BEGIN");
    try {
      const out = statements.map((s) => s._execute());
      this.db.exec("COMMIT");
      return out;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async exec(sql: string): Promise<{ count: number; duration: number }> {
    this.db.exec(sql);
    return { count: 0, duration: 0 };
  }

  async dump(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }
}

// Strip statements wrangler/D1 understands but plain SQLite does not, and split
// the migration into individual statements honoring BEGIN/COMMIT-free execution.
export function createMigratedDb(migrationsDir: string): SqliteD1 {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    db.exec(sql);
  }

  return new SqliteD1(db);
}
