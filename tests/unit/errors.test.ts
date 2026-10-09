import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { databaseHint, errorDetail } from "@/lib/errors";

describe("database error hints", () => {
  it("unwraps the driver error behind a drizzle 'Failed query' error", async () => {
    const client = postgres("postgresql://prepx:prepx@127.0.0.1:5499/prepx", { max: 1, connect_timeout: 3 });
    const db = drizzle(client);
    let caught: unknown;
    try {
      await db.execute(sql`insert into rate_limits (key, window_start, count) values (${"k"}, now(), 1)`);
    } catch (e) {
      caught = e;
    }
    await client.end();
    expect(errorDetail(caught)).toMatch(/ECONNREFUSED/);
    expect(databaseHint(caught)).toMatch(/Can't reach the database/);
  });

  it("explains missing tables and rejected passwords", () => {
    expect(databaseHint({ message: "x", cause: { code: "42P01" } })).toMatch(/npm run db:setup/);
    expect(databaseHint({ code: "28P01" })).toMatch(/rejected the username/);
    expect(databaseHint(new Error("other"))).toBeNull();
  });
});
