/** Flattens an error and its `cause` chain into one readable line (drizzle wraps driver errors). */
export function errorDetail(e: unknown): string {
  const parts: string[] = [];
  let cur: unknown = e;
  for (let i = 0; cur && i < 5; i++) {
    const err = cur as { message?: string; code?: string; cause?: unknown };
    const msg = (err.message ?? String(cur)).split("\n")[0].replace(/^Failed query: .*/, "Database query failed");
    parts.push(err.code ? `${msg} [${err.code}]` : msg);
    cur = err.cause;
  }
  return parts.join(" → ");
}

/** Plain-language hint for the most common local database problems, or null. */
export function databaseHint(e: unknown): string | null {
  let cur: unknown = e;
  for (let i = 0; cur && i < 5; i++) {
    const code = (cur as { code?: string }).code;
    if (code === "ECONNREFUSED") return "Can't reach the database. Is the Postgres container running (docker ps) and does the port in DATABASE_URL match it?";
    if (code === "ENOTFOUND") return "The database host in DATABASE_URL can't be found.";
    if (code === "28P01" || code === "28000") return "The database rejected the username/password. You may be connecting to a different Postgres on that port; check DATABASE_URL.";
    if (code === "3D000") return "The database named in DATABASE_URL doesn't exist.";
    if (code === "42P01") return "Database tables are missing. Run: npm run db:setup";
    cur = (cur as { cause?: unknown }).cause;
  }
  return null;
}
