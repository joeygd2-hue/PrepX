import { expect, test } from "@playwright/test";
import { newStudent } from "./helpers";

test("unauthenticated visitors are sent to sign-in and APIs refuse them", async ({ page, request }) => {
  for (const path of ["/", "/study", "/calendar", "/chapter", "/profile", "/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/sign-in/);
  }
  expect((await request.get("/api/me/export")).status()).toBe(401);
  expect((await request.get("/api/calendar/all")).status()).toBe(401);
  expect((await request.get("/api/cron/cleanup")).status()).toBe(401);
  expect((await request.get("/api/cron/cleanup", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
  expect((await request.get("/api/cron/cleanup", { headers: { authorization: "Bearer e2e-secret" } })).status()).toBe(200);
});

test("students can't open the admin console or other students' attempts", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  await newStudent(a, "own");
  await a.goto("/study/events?federation=deca");
  await a.getByRole("link", { name: /Principles of Business Management/ }).click();
  await a.getByRole("button", { name: "Study this event" }).click();
  await a.waitForURL(/\/study$/);
  await a.getByRole("link", { name: /Quick 10/ }).click();
  await a.getByRole("button", { name: "Start" }).click();
  await a.waitForURL(/attempt\//);
  const attemptUrl = new URL(a.url()).pathname;

  const b = await (await browser.newContext()).newPage();
  await newStudent(b, "intruder");
  await b.goto("/admin");
  await expect(b).not.toHaveURL(/admin/);
  const res = await b.goto(attemptUrl);
  expect(res?.status()).toBe(404);
});

test("empty and offline states render", async ({ page }) => {
  await newStudent(page, "empty");
  await page.goto("/notifications");
  await expect(page.getByText("You're all caught up")).toBeVisible();
  await page.goto("/study/history?exam=deca-bac");
  await expect(page.getByText("No attempts yet")).toBeVisible();
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  const manifest = await page.request.get("/manifest.webmanifest");
  expect((await manifest.json()).display).toBe("standalone");
});
