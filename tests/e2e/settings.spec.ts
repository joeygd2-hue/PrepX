import { expect, test } from "@playwright/test";
import { choosePBM, newStudent, sql } from "./helpers";

test("privacy settings persist and change what others can see", async ({ page }) => {
  const email = await newStudent(page, "priv", { first: "Riley" });
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Riley Rivera" })).toBeVisible();
  // Leaderboards are opt-in.
  await expect(page.getByLabel("Leaderboards")).toHaveValue("hidden");
  await page.getByLabel("Leaderboards").selectOption("pseudonym");
  await page.waitForTimeout(500);
  const [row] = await sql`select p.leaderboard_visibility, p.hide_name_on_trophies, p.public_trophy_id from profiles p join users u on u.id = p.user_id where lower(u.email) = ${email.toLowerCase()}`;
  expect(row.leaderboard_visibility).toBe("pseudonym");
  // Public trophy page hides the name by default.
  await page.goto(`/trophies/${row.public_trophy_id}`);
  await expect(page.getByRole("heading", { name: "A PrepX competitor" })).toBeVisible();
  await page.goto("/profile");
  await page.getByRole("switch", { name: "Hide my name on public trophy pages" }).click();
  await page.waitForTimeout(500);
  await page.goto(`/trophies/${row.public_trophy_id}`);
  await expect(page.getByRole("heading", { name: "Riley" })).toBeVisible();
  // Notification toggle persists.
  await page.goto("/profile");
  await page.getByRole("switch", { name: "Weekly recap email" }).click();
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByRole("switch", { name: "Weekly recap email" })).toHaveAttribute("aria-checked", "false");
  // Locked colors can't be chosen at level 1.
  await expect(page.getByRole("radio", { name: /Legend/ })).toBeDisabled();
});

test("calendar shows the official date and exports an .ics file", async ({ page }) => {
  await newStudent(page, "cal");
  await choosePBM(page);
  await page.goto("/calendar");
  await expect(page.getByText("DECA International Career Development Conference").first()).toBeVisible();
  await expect(page.getByText(/Study milestone/).first()).toBeVisible();
  const res = await page.request.get("/api/calendar/all");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/calendar");
  const body = await res.text();
  expect(body).toContain("BEGIN:VCALENDAR");
  expect(body).toContain("DTSTART;VALUE=DATE:20270417");
  await page.goto("/calendar/region");
  await page.getByRole("button", { name: "Texas" }).first().click();
  await page.getByRole("button", { name: "District 3 · Fort Bend and Harris counties" }).click();
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByRole("button", { name: "District 3 · Fort Bend and Harris counties" })).toHaveAttribute("aria-pressed", "true");
});

test("account deletion removes the account and signs out", async ({ page }) => {
  const email = await newStudent(page, "del");
  const dl = await page.request.get("/api/me/export");
  expect(dl.status()).toBe(200);
  expect((await dl.json()).account.email).toBe(email.toLowerCase());
  await page.goto("/profile/delete");
  await page.getByLabel("Type DELETE to confirm").fill("nope");
  await page.getByRole("button", { name: "Permanently delete my account" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Type DELETE");
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Permanently delete my account" }).click();
  await page.waitForURL(/sign-in/);
  expect(await sql`select id from users where lower(email) = ${email.toLowerCase()}`).toHaveLength(0);
  await page.goto("/study");
  await expect(page).toHaveURL(/sign-in/);
});
