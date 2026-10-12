import { expect, test } from "@playwright/test";
import { choosePBM, newStudent } from "./helpers";

test("Study links the planner and focus mode; the planner sets today's goal", async ({ page }) => {
  await newStudent(page, "plan");
  await choosePBM(page);
  await expect(page.getByRole("link", { name: /Head-to-head duels/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Bookmarks/ })).toBeVisible();

  await page.getByRole("link", { name: /Study planner/ }).click();
  await page.waitForURL(/study\/planner/);
  for (const day of ["Sat", "Sun"]) {
    const chip = page.getByRole("group", { name: "Study days" }).getByRole("button", { name: new RegExp(`^${day}`) });
    if ((await chip.getAttribute("aria-pressed")) === "true") await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "false");
  }
  await page.getByRole("button", { name: "Save plan" }).click();
  await expect(page.getByRole("status").or(page.getByRole("alert")).first()).toBeVisible();

  await page.goto("/study");
  await expect(page.getByText(/Today's plan · \d+ min goal|Rest day · optional practice/)).toBeVisible();

  await page.getByRole("link", { name: /Focus mode/ }).first().click();
  await page.waitForURL(/study\/focus/);
  await page.getByRole("button", { name: "Start focus" }).click();
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
});

test("the course reader flips through a lesson", async ({ page }) => {
  await newStudent(page, "read");
  await choosePBM(page);
  await page.getByRole("link", { name: /^Lessons/ }).click();
  await page.waitForURL(/study\/learn\?/);
  await page.locator("a[href^='/study/learn/']").first().click();
  await page.waitForURL(/study\/learn\/[^?]+$/);
  const pages = page.getByRole("navigation", { name: "Lesson pages" });
  await pages.getByRole("button", { name: "Start reading" }).click();
  await expect(pages.getByRole("button", { name: /Next|Finish lesson/ })).toBeVisible();
  await pages.getByRole("button", { name: /Next|Finish lesson/ }).click();
  await expect(page.getByRole("progressbar", { name: "Lesson progress" }).or(page.getByLabel("Lesson progress")).first()).toBeVisible();
});

test("bookmark a question in Quick 10, then find it in Bookmarks; create a duel", async ({ page }) => {
  await newStudent(page, "mark");
  await choosePBM(page);
  await page.getByRole("link", { name: /Quick 10/ }).click();
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForURL(/study\/attempt\//);
  await page.getByRole("radio").first().click();
  await expect(page.locator("div[role=status]")).toContainText(/Correct|Not quite/);
  await page.getByRole("button", { name: "Bookmark question" }).click();
  await expect(page.getByRole("button", { name: "Bookmark question" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Saved to Bookmarks")).toBeVisible();

  await page.goto("/study");
  await expect(page.getByText("1 saved question")).toBeVisible();
  await page.getByRole("link", { name: /Bookmarks/ }).click();
  await expect(page.getByRole("link", { name: /Practice/ }).first()).toBeVisible();

  await page.goto("/study");
  await page.getByRole("link", { name: /Head-to-head duels/ }).click();
  await page.getByRole("button", { name: "Create duel" }).click();
  await expect(page.getByRole("button", { name: "Copy code" })).toBeVisible();
});
