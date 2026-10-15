import { getCurrentUser } from "@/server/auth/session";
import { exportAccount } from "@/server/account";
import { rateLimit } from "@/server/ratelimit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!(await rateLimit(`export:${user.id}`, 5, 3600))) return new Response("Too many exports. Try again later.", { status: 429 });
  const data = await exportAccount(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="prepx-my-data.json"', "Cache-Control": "no-store" },
  });
}
