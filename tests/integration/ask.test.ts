import { describe, expect, it } from "vitest";
import { getAllowance } from "@/server/entitlements";
import { withUsage } from "@/server/ai/run";
import { askRequest, askTutor } from "@/server/ai/ask";
import { makeUser } from "../support/factory";

const TZ = "America/Chicago";

describe("Ask AI", () => {
  it("builds quick-action requests on the server and passes typed questions through", () => {
    expect(askRequest("define", null)).toMatch(/Define this/);
    expect(askRequest("question", "  What is ROI?  ")).toBe("What is ROI?");
    expect(askRequest("question", null)).toBe("");
  });

  it("answers about highlighted text and charges one ask_ai use", async () => {
    const u = await makeUser();
    const before = await getAllowance(u.id, "ask_ai", TZ);
    expect(before.limit).toBe(20);
    const answer = await withUsage(u.id, "ask_ai", TZ, () =>
      askTutor({ selection: "opportunity cost", context: "The opportunity cost of a choice is the next best alternative given up.", eventLine: null, turns: [{ role: "user", content: askRequest("define", null) }] }),
    );
    expect(answer).toMatch(/\[Test AI\]/);
    expect((await getAllowance(u.id, "ask_ai", TZ)).remaining).toBe(19);
  });

  it("doesn't charge when the AI fails", async () => {
    const u = await makeUser();
    await expect(
      withUsage(u.id, "ask_ai", TZ, () => askTutor({ selection: "x", context: "", eventLine: null, turns: [{ role: "user", content: "fail-ai please" }] })),
    ).rejects.toThrow();
    expect((await getAllowance(u.id, "ask_ai", TZ)).remaining).toBe(20);
  });
});
