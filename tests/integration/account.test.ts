import { describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { deleteAccount, exportAccount } from "@/server/account";
import { createChapter, joinChapter, postAnnouncement } from "@/server/chapters";
import { startAttempt, submitAttempt } from "@/server/exams";
import { upsertVerifiedUser } from "@/server/auth/accounts";
import { requestSignInCode, verifySignInCode } from "@/server/auth/email-code";
import { makeUser } from "../support/factory";

describe("account deletion", () => {
  it("removes personal data, hands advisor rights to an officer, keeps chapter announcements anonymously", async () => {
    const adv = await makeUser();
    const officer = await makeUser();
    const c = await createChapter(adv.id, { org: "deca", name: "Handoff", school: "S" });
    await joinChapter(officer.id, c.joinCode);
    await db.update(schema.chapterMembers).set({ role: "officer" }).where(eq(schema.chapterMembers.userId, officer.id));
    const a = await postAnnouncement(adv.id, c.id, "Welcome", "Hello");
    await submitAttempt(adv.id, "UTC", await startAttempt({ userId: adv.id, tz: "UTC", clusterId: "deca-bac", mode: "quick10" }));

    const exported = await exportAccount(adv.id);
    expect(exported.account?.email).toContain("@prepx.test");
    expect(exported.examAttempts.length).toBe(1);

    await deleteAccount(adv.id, "test");
    expect(await db.select().from(schema.users).where(eq(schema.users.id, adv.id))).toHaveLength(0);
    expect(await db.select().from(schema.profiles).where(eq(schema.profiles.userId, adv.id))).toHaveLength(0);
    expect(await db.select().from(schema.examAttempts).where(eq(schema.examAttempts.userId, adv.id))).toHaveLength(0);
    const [promoted] = await db.select().from(schema.chapterMembers).where(and(eq(schema.chapterMembers.chapterId, c.id), eq(schema.chapterMembers.userId, officer.id)));
    expect(promoted.role).toBe("advisor");
    const [ann] = await db.select().from(schema.chapterAnnouncements).where(eq(schema.chapterAnnouncements.id, a.id));
    expect(ann.authorId).toBeNull();
    const [audit] = await db.select().from(schema.auditLog).where(sql`${schema.auditLog.action} = 'account_deleted'`).limit(1);
    expect(JSON.stringify(audit)).not.toContain("@prepx.test");
  });

  it("deletes a chapter left with no members", async () => {
    const adv = await makeUser();
    const c = await createChapter(adv.id, { org: "hosa", name: "Solo", school: "S" });
    await deleteAccount(adv.id, "test");
    expect(await db.select().from(schema.chapters).where(eq(schema.chapters.id, c.id))).toHaveLength(0);
  });
});

describe("sign-in", () => {
  it("issues single-use 6-digit codes with an attempt cap", async () => {
    const email = `code${Date.now()}@prepx.test`;
    await requestSignInCode(email, "127.0.0.9");
    const [log] = await db.select().from(schema.emailLog).where(eq(schema.emailLog.to, email));
    const code = /code is (\d{6})/.exec(log.body!)![1];
    expect(await verifySignInCode(email, "000000" === code ? "111111" : "000000", "127.0.0.9")).toBe(false);
    expect(await verifySignInCode(email.toUpperCase(), code, "127.0.0.9")).toBe(true);
    expect(await verifySignInCode(email, code, "127.0.0.9")).toBe(false); // used
    // Codes are stored hashed only.
    const rows = await db.select().from(schema.emailCodes).where(eq(schema.emailCodes.email, email));
    expect(JSON.stringify(rows)).not.toContain(code);
  });

  it("locks a code after 5 wrong attempts", async () => {
    const email = `lock${Date.now()}@prepx.test`;
    await requestSignInCode(email, "127.0.0.8");
    const [log] = await db.select().from(schema.emailLog).where(eq(schema.emailLog.to, email));
    const code = /code is (\d{6})/.exec(log.body!)![1];
    const wrong = code === "123456" ? "654321" : "123456";
    for (let i = 0; i < 5; i++) await verifySignInCode(email, wrong, "127.0.0.8");
    expect(await verifySignInCode(email, code, "127.0.0.8")).toBe(false);
  });

  it("rate-limits code requests per email", async () => {
    const email = `rl${Date.now()}@prepx.test`;
    for (let i = 0; i < 5; i++) await requestSignInCode(email, `10.0.0.${i}`);
    await expect(requestSignInCode(email, "10.0.0.99")).rejects.toThrow(/Too many/);
  });

  it("creates one account per email (case-insensitive) and promotes configured admins", async () => {
    const a = await upsertVerifiedUser("Mixed.Case@Prepx.Test");
    const b = await upsertVerifiedUser("mixed.case@prepx.test", "google-sub-1");
    expect(a.isNew).toBe(true);
    expect(b).toEqual({ id: a.id, isNew: false });
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, a.id));
    expect(u.googleSub).toBe("google-sub-1");
    const boss = await upsertVerifiedUser("boss@prepx.test");
    const [bu] = await db.select().from(schema.users).where(eq(schema.users.id, boss.id));
    expect(bu.role).toBe("admin");
  });
});
