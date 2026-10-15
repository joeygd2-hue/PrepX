import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

export default async function setup() {
  const url = process.env.E2E_DATABASE_URL ?? "postgresql://prepx:prepx@localhost:5432/prepx_e2e";
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  // Tests exercise the free plan; the launch period (Pro for everyone) is switched on per test.
  await sql`delete from app_settings where key = 'launch_access'`;
  await sql.end();
  process.env.DATABASE_URL = url;
  const { seedAll } = await import("../../src/db/seed");
  await seedAll();
}
