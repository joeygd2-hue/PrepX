import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

/** Recreates the test database schema, applies migrations and seeds content. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://prepx:prepx@localhost:5432/prepx_test";
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  await sql.end();
  process.env.DATABASE_URL = url;
  const { seedAll } = await import("../../src/db/seed");
  await seedAll();
  const { db } = await import("../../src/db");
  // Close the seeding pool so test workers start clean.
  await (db.$client as unknown as { end: () => Promise<void> }).end();
}
