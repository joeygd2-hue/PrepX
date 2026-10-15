import { getCurrentUser } from "@/server/auth/session";
import { ChapterError } from "@/server/chapters";
import { gameState } from "@/server/quiz";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    return Response.json(await gameState(user.id, id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ChapterError) return Response.json({ error: e.message }, { status: 403 });
    throw e;
  }
}
