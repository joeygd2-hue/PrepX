import { expect, type Page } from "@playwright/test";
import postgres from "postgres";

export const sql = postgres(process.env.E2E_DATABASE_URL ?? "postgresql://prepx:prepx@localhost:5432/prepx_e2e", { max: 2, onnotice: () => {} });

export const uniqueEmail = (tag: string) => `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@e2e.test`;

async function latestCode(email: string) {
  for (let i = 0; i < 20; i++) {
    const rows = await sql`select body from email_log where "to" = ${email.toLowerCase()} order by created_at desc limit 1`;
    const m = rows[0] && /code is (\d{6})/.exec(rows[0].body as string);
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("no code email");
}

export async function signIn(page: Page, email: string) {
  await page.goto("/sign-in/email");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.waitForURL(/step=code/);
  await page.getByLabel("6-digit code").fill(await latestCode(email));
  await page.getByRole("button", { name: "Continue" }).click();
}

export async function onboard(page: Page, opts: { first?: string; birth?: string; org?: string } = {}) {
  await page.waitForURL(/welcome/);
  await page.getByRole("link", { name: "Continue" }).click();
  const step = (name: RegExp) => expect(page.getByRole("heading", { name })).toBeVisible();
  // The age check comes first: nothing else is asked before it.
  await step(/birthday/);
  await page.getByLabel("Date of birth").fill(opts.birth ?? "2010-05-01");
  await page.getByRole("button", { name: "Continue" }).click();
  if (opts.birth && Number(opts.birth.slice(0, 4)) > 2013) return;
  await step(/What's your name/);
  await page.getByLabel("First name").fill(opts.first ?? "Jordan");
  await page.getByLabel("Last name").fill("Rivera");
  await page.getByRole("button", { name: "Continue" }).click();
  await step(/school/);
  await page.getByLabel("Grade").selectOption("10");
  await page.getByRole("button", { name: "Continue" }).click();
  await step(/organizations/);
  await page.locator(`input[name=org][value=${opts.org ?? "deca"}]`).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await step(/One last thing/);
  await page.locator("input[name=terms]").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/study\/events/);
}

export async function newStudent(page: Page, tag = "s", opts: { first?: string } = {}) {
  const email = uniqueEmail(tag);
  await signIn(page, email);
  await onboard(page, opts);
  return email;
}

export async function choosePBM(page: Page) {
  await page.goto("/study/events?federation=deca");
  await page.getByRole("link", { name: /Principles of Business Management and Administration/ }).click();
  await page.getByRole("button", { name: "Study this event" }).click();
  await page.waitForURL(/\/study$/);
  await expect(page.getByRole("heading", { name: "Principles of Business Management and Administration" })).toBeVisible();
}
