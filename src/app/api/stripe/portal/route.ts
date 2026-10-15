import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { createPortal } from "@/server/billing";
import { env } from "@/lib/env";
import { assertSameOrigin } from "@/server/request";

export async function POST(req: Request) {
  assertSameOrigin(req);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/sign-in", env.appUrl), 303);
  const url = await createPortal(user.id);
  return NextResponse.redirect(url ?? new URL("/profile/plan", env.appUrl), 303);
}
