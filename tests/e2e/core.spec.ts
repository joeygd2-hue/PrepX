import { expect, test } from "@playwright/test";
import { choosePBM, newStudent, onboard, signIn, sql, uniqueEmail } from "./helpers";

test("new student registers, onboards, picks an event and gets a dynamic countdown and plan", async ({ page }) => {
  await newStudent(page, "reg", { first: "Jordan" });
  await expect(page.getByRole("heading", { name: "Choose your event" })).toBeVisible();
  await expect(page.getByText("HEALTH SCIENCE")).toHaveCount(0); // DECA chosen at onboarding
  await page.getByLabel("Search").fill("finance");
  await expect(page.getByRole("link", { name: /Principles of Finance/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Principles of Marketing/ })).toHaveCount(0);
  await choosePBM(page);
  await expect(page.getByText("Test: Business Administration Core exam (100 questions, 60 min)")).toBeVisible();
  await expect(page.getByText("Role-play: 10 min prep, 10 min with the judge, 4 indicators")).toBeVisible();
  await expect(page.getByText(/days to DECA International Career Development Conference/i)).toBeVisible();
  await expect(page.getByText("6 weeks out · Learn the material")).toBeVisible();
  await expect(page.getByText("Judged practice · 75%")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /^(Good morning|Good afternoon|Good evening|Up late), Jordan$/ })).toBeVisible();
  await expect(page.getByText("days to go")).toBeVisible();
  await expect(page.getByText(/Today's plan/i)).toBeVisible();
});

test("students under 13 are refused and nothing is kept", async ({ page }) => {
  const email = uniqueEmail("young");
  await signIn(page, email);
  await onboard(page, { birth: "2015-01-01" });
  await page.waitForURL(/too-young/);
  await expect(page.getByRole("heading", { name: /13 and older/ })).toBeVisible();
  const rows = await sql`select id from users where lower(email) = ${email.toLowerCase()}`;
  expect(rows).toHaveLength(0);
  // Retrying right away from the same browser with an older date is refused too.
  await signIn(page, email);
  await page.waitForURL(/welcome/);
  await page.getByRole("link", { name: "Continue" }).click();
  await page.getByLabel("Date of birth").fill("2005-01-01");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/too-young/);
  expect(await sql`select id from users where lower(email) = ${email.toLowerCase()}`).toHaveLength(0);
});

test("a sign-up can be cancelled during onboarding and nothing is kept", async ({ page }) => {
  const email = uniqueEmail("cancel");
  await signIn(page, email);
  await page.waitForURL(/welcome/);
  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: /birthday/ })).toBeVisible();
  await page.getByRole("button", { name: "Cancel sign-up" }).click();
  await page.getByRole("button", { name: "Delete and leave" }).click();
  await page.waitForURL(/\/sign-in$/);
  expect(await sql`select id from users where lower(email) = ${email.toLowerCase()}`).toHaveLength(0);
});

test("Quick 10: answer, see explanations, submit and review results", async ({ page }) => {
  await newStudent(page, "q10");
  await choosePBM(page);
  await page.getByRole("link", { name: /Quick 10/ }).click();
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForURL(/study\/attempt\//);
  for (let i = 0; i < 10; i++) {
    await page.getByRole("radio").first().click();
    await expect(page.locator("div[role=status]")).toContainText(/Correct|Not quite/);
    await page.getByRole("button", { name: i < 9 ? "Next" : "See results", exact: true }).click();
  }
  await page.waitForURL(/review/);
  await expect(page.getByText(/of 10 correct/)).toBeVisible();
  await expect(page.getByText("By topic")).toBeVisible();
  await page.goto("/study");
  await expect(page.getByText("questions done")).toBeVisible();
});

test("AI judge run with the test provider, then the free daily limit applies", async ({ page }) => {
  await newStudent(page, "judge");
  await choosePBM(page);
  await expect(page.getByText("1 run left today")).toBeVisible();
  await page.getByRole("link", { name: /Role-play judge/ }).click();
  await page.getByRole("button", { name: "Start a practice round" }).click();
  await page.waitForURL(/study\/judge\/[0-9a-f-]{36}/);
  await expect(page.getByText("Performance indicators")).toBeVisible();
  await page.getByRole("button", { name: "Skip prep, start now" }).click();
  await page.getByLabel("Your response (speak or type)").fill("Good afternoon. I recommend a mentoring program and flexible scheduling to cut turnover, which costs about six hundred dollars per new hire, and I will measure results monthly.");
  await page.getByRole("button", { name: "Finish and get feedback" }).click();
  await expect(page.getByText("Simulated practice score")).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("Score breakdown")).toBeVisible();
  await expect(page.getByText(/not an official result/)).toBeVisible();
  await page.goto("/study/judge");
  await expect(page.getByText(/You've used today's judge runs/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Start a practice round" })).toBeDisabled();
});

test("AI coach replies and failed AI calls aren't charged", async ({ page }) => {
  await newStudent(page, "coach");
  await choosePBM(page);
  await page.goto("/study/coach");
  await expect(page.getByText("10 messages left today")).toBeVisible();
  await page.getByLabel("Message the coach").fill("What is opportunity cost?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/\[Test AI\]/)).toBeVisible();
  await expect(page.getByText("9 messages left today")).toBeVisible();
  await page.getByLabel("Message the coach").fill("fail-ai please");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("p[role=alert]")).toContainText(/weren't charged|didn't respond/);
  await page.reload();
  await expect(page.getByText("9 messages left today")).toBeVisible();
});
