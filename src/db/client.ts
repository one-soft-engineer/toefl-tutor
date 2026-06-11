import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

type DB = ReturnType<typeof drizzle<typeof schema>>;

let cached: DB | null = null;

// Lazily create the client. Locally (no Turso env) this is a SQLite file;
// in the cloud it points at Turso (libSQL over HTTP). Lazy so importing this
// module during `next build` page-data collection does not open a connection.
export function getDb(): DB {
  if (!cached) {
    const url = process.env.TURSO_DATABASE_URL ?? "file:local.db";
    const authToken = process.env.TURSO_AUTH_TOKEN;
    cached = drizzle(createClient({ url, authToken }), { schema });
  }
  return cached;
}
