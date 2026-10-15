/**
 * Diagnoses the local database setup: connection, tables and seeded content.
 *   npm run db:check
 */
import "dotenv/config";
import postgres from "postgres";
import { databaseHint, errorDetail } from "../src/lib/errors";

const url = process.env.DATABASE_URL ?? "postgresql://prepx:prepx@localhost:5432/prepx";
console.log(`DATABASE_URL = ${url.replace(/:[^:@/]+@/, ":***@")}`);
const sql = postgres(url, { max: 1, onnotice: () => {}, connect_timeout: 5 });

let ok = true;
try {
  const [{ version }] = await sql`select version()`;
  console.log(`✓ Connected: ${String(version).split(" on ")[0]}`);
  const [{ n: tables }] = await sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`;
  if (tables < 40) {
    ok = false;
    console.log(`✗ Only ${tables} tables found. Run: npm run db:setup`);
  } else {
    console.log(`✓ ${tables} tables`);
    const [{ events }] = await sql`select count(*)::int as events from events`;
    const [{ questions }] = await sql`select count(*)::int as questions from questions`;
    if (!events) {
      ok = false;
      console.log("✗ No events loaded. Run: npm run db:seed");
    } else console.log(`✓ ${events} events, ${questions} practice questions`);
    await sql`select 1 from rate_limits limit 1`;
    console.log("✓ Sign-in tables are reachable");
  }
} catch (e) {
  ok = false;
  console.log(`✗ ${errorDetail(e)}`);
  const hint = databaseHint(e);
  if (hint) console.log(`  Hint: ${hint}`);
}
await sql.end();
console.log(ok ? "\nDatabase looks good. Start the app with: npm run dev" : "\nFix the item above, then run npm run db:check again.");
process.exit(ok ? 0 : 1);
