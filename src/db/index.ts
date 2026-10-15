import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __prepxSql: ReturnType<typeof postgres> | undefined;
}

const url = process.env.DATABASE_URL ?? "postgresql://prepx:prepx@localhost:5432/prepx";

// Reuse one pool across hot reloads in dev.
const client = globalThis.__prepxSql ?? postgres(url, { max: 10, prepare: false });
if (process.env.NODE_ENV !== "production") globalThis.__prepxSql = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
export { schema };
