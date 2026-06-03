import type { Env } from "../types";

export function getDb(env: Env["Bindings"]): D1Database {
  return env.DB;
}
