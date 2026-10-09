import { expect, test } from "@playwright/test";
import { newStudent } from "./helpers";

test("advisor creates a chapter; student joins with a valid code after an invalid one; roles are enforced", async ({ browser }) => {
  const advisor = await (await browser.newContext()).newPage();
  await newStudent(advisor, "adv", { first: "Avery" });
  await advisor.goto("/chapter");
  await expect(advisor.getByRole("heading", { name: "No chapter yet" })).toBeVisible();
  await advisor.goto("/chapter/new");
  await advisor.getByLabel("Chapter name").fill("Lakeside DECA");
  await advisor.getByLabel("School").fill("Lakeside High");
  await advisor.getByRole("checkbox").check();
  await advisor.getByRole("button", { name: "Create chapter" }).click();
  await advisor.waitForURL(/manage\?created=1/);
  const code = (await advisor.locator("p.tracking-\\[0\\.3em\\]").textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);

  const student = await (await browser.newContext()).newPage();
  await newStudent(student, "mem", { first: "Sam" });
  await student.goto("/join");
  await student.getByLabel("Join code").fill("ZZZZZ2");
  await student.getByRole("button", { name: "Join chapter" }).click();
  await expect(student.locator("p[role=alert]")).toContainText(/doesn't match/);
  await student.getByLabel("Join code").fill(code.toLowerCase());
  await student.getByRole("button", { name: "Join chapter" }).click();
  await student.waitForURL(/chapter\?joined=1/);
  await expect(student.getByText("You joined Lakeside DECA")).toBeVisible();
  // A member can't reach the management console.
  const manageUrl = advisor.url().replace(/\?.*/, "");
  await student.goto(new URL(manageUrl).pathname);
  await expect(student).toHaveURL(/\/chapter$/);

  // Advisor posts an announcement and opens a check-in; student checks in.
  await advisor.goto(manageUrl);
  await advisor.getByLabel("Title").fill("Practice night");
  await advisor.getByLabel("Message").fill("Bring your laptops Thursday.");
  await advisor.getByRole("button", { name: "Post to members" }).click();
  await expect(advisor.getByText("Announcement posted.")).toBeVisible();
  await advisor.getByLabel("Meeting").fill("General meeting");
  await advisor.getByRole("button", { name: "Open check-in" }).click();
  await expect(advisor.getByText("Check-in is open.")).toBeVisible();
  await student.goto("/chapter");
  await expect(student.getByText("Practice night")).toBeVisible();
  await student.getByRole("button", { name: "Check in" }).click();
  await expect(student.getByText("You're checked in!")).toBeVisible();
});
