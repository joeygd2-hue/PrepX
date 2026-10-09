import { expect, test } from "@playwright/test";
import { choosePBM, newStudent } from "./helpers";

test("mobile: bottom navigation works and pages don't scroll sideways", async ({ page }) => {
  await newStudent(page, "mobile", { first: "Mo" });
  await choosePBM(page);
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link")).toHaveCount(5);
  for (const [name, path] of [["Home", "/"], ["Study", "/study"], ["Calendar", "/calendar"], ["Chapter", "/chapter"], ["Profile", "/profile"]] as const) {
    await nav.getByRole("link", { name }).click();
    await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/$" : path}`));
    await expect(nav.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
