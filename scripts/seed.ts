import "dotenv/config";
import { seedAll } from "../src/db/seed";

console.log("Seeding PrepX content…");
await seedAll((m) => console.log(m));
console.log("Done.");
process.exit(0);
