import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { CheckoutRefusedError, createCheckout } from "@/server/billing";
import { env, features } from "@/lib/env";
import { assertSameOrigin } from "@/server/request";
import { errorDetail } from "@/lib/errors";

export async function POST(req: Request) {
  assertSameOrigin(req);
  const user = await getCurrentUser();
  if (!user?.profile?.onboardingCompletedAt) return NextResponse.redirect(new URL("/sign-in", env.appUrl), 303);
  if (!features.billing()) return NextResponse.redirect(new URL("/profile/plan", env.appUrl), 303);
  const form = await req.formData();
  const kind = form.get("kind") === "season_boost" ? "season_boost" : "pro";
  try {
    const url = await createCheckout(user.id, user.email, kind);
    return NextResponse.redirect(url, 303);
  } catch (e) {
    if (e instanceof CheckoutRefusedError) return NextResponse.redirect(new URL(`/profile/plan?checkout=${e.code}`, env.appUrl), 303);
    console.error("checkout failed", errorDetail(e));
    return NextResponse.redirect(new URL("/profile/plan?checkout=cancelled", env.appUrl), 303);
  }
}
