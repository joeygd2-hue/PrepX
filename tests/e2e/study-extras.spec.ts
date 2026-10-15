import { expect, test } from "@playwright/test";
import { choosePBM, newStudent, sql } from "./helpers";

test("the Study area takes on the selected organization's theme", async ({ page }) => {
  await newStudent(page, "theme");
  await choosePBM(page);
  await expect(page.locator("html")).toHaveAttribute("data-org", "deca");
  await page.getByRole("tab", { name: /HOSA/ }).click();
  await expect(page.getByRole("tab", { name: /HOSA/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("html")).toHaveAttribute("data-org", "hosa");
  await expect(page.getByRole("heading", { name: "Choose your HOSA event" })).toBeVisible();
  // Leaving the Study area returns to the student's own colors.
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Home" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-org", /.+/);
});

test("Ask AI explains highlighted text and answers follow-ups", async ({ page }) => {
  await newStudent(page, "ask");
  await choosePBM(page);
  const line = page.getByText("Role-play: 10 min prep, 10 min with the judge, 4 indicators");
  await line.click({ clickCount: 3 });
  await page.getByRole("button", { name: /Ask AI about the selected text/ }).click();
  const panel = page.getByRole("dialog", { name: "Ask AI" });
  await expect(panel.getByText(/\[Test AI\]/)).toBeVisible();
  await expect(panel.getByText("19 left today")).toBeVisible();
  await panel.getByLabel("Ask a question").fill("How long is the prep time?");
  await panel.getByRole("button", { name: "Send", exact: true }).click();
  await expect(panel.getByText(/\[Test AI\].*How long is the prep time/)).toBeVisible();
  await expect(panel.getByText("18 left today")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  // The header button opens it for a typed question.
  await page.getByRole("button", { name: "Ask AI", exact: true }).click();
  await panel.getByLabel("Ask a question").fill("What is a performance indicator?");
  await panel.getByRole("button", { name: "Send", exact: true }).click();
  await expect(panel.getByText(/\[Test AI\].*performance indicator/)).toBeVisible();
});

test("during the launch period everyone gets Pro, with a banner", async ({ page }) => {
  await sql`insert into app_settings (key, value) values ('launch_access', ${sql.json({ endsOn: "2099-12-31" })}) on conflict (key) do update set value = excluded.value`;
  try {
    await newStudent(page, "launch");
    await choosePBM(page);
    await expect(page.getByText("Everything is free during launch.")).toBeVisible();
    await expect(page.getByText("15 runs left today")).toBeVisible();
  } finally {
    await sql`delete from app_settings where key = 'launch_access'`;
  }
});
