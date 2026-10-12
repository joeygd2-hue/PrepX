// Renders one ad page to PNG frames: node render.mjs <page.html> <outDir> all [fps]
import { createRequire } from "node:module";
const require = createRequire(new URL("../../package.json", import.meta.url));
const { chromium } = require("playwright");
const [, , html, out, list, fpsArg] = process.argv;
const dir = new URL(".", import.meta.url).pathname;
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
await page.goto("file://" + dir + html);
await page.evaluate(() => document.fonts.ready);
const dur = await page.evaluate(() => window.DURATION ?? 18);
const fps = +fpsArg || 30;
const times = list === "all" ? Array.from({ length: Math.round(dur * fps) }, (_, i) => i / fps) : list.split(",").map(Number);
for (let i = 0; i < times.length; i++) {
  await page.evaluate((t) => window.render(t), times[i]);
  await page.screenshot({ path: `${out}/f${String(i).padStart(4, "0")}.png` });
}
await browser.close();
