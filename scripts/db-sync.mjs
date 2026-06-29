// Push a SQL reload script (read from stdin) into the cloud Turso database using
// a long-lived DB token (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN) via @libsql/client.
//
// This deliberately does NOT use the `turso` CLI: the CLI's interactive login
// session expires, which silently broke the daily sync. A DB token does not
// expire, so unattended runs keep working.
//
// Reads the combined "DROP ...; <dump>" SQL on stdin. Verifies row counts after
// and exits non-zero on any failure so callers (and the daily job) fail loudly.
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error(
    "error: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set (see .env.sync)"
  );
  process.exit(1);
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

const raw = await readStdin();
// executeMultiple runs a semicolon-separated script; strip the dump's explicit
// transaction wrappers since we run it as one batch.
const sql = raw
  .split("\n")
  .filter((l) => !/^\s*(BEGIN TRANSACTION|COMMIT)\s*;\s*$/i.test(l))
  .join("\n");

const client = createClient({ url, authToken });

try {
  await client.executeMultiple(sql);

  const tables = ["questions", "attempts", "wrong_words", "card_progress"];
  const counts = [];
  for (const t of tables) {
    const r = await client.execute(`select count(*) as c from ${t}`);
    counts.push(`${t} ${r.rows[0].c}`);
  }
  console.log("Turso row counts: " + counts.join(", "));
} catch (e) {
  console.error("error: Turso sync failed:", e.message ?? e);
  process.exit(1);
} finally {
  client.close();
}
