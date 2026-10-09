import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { ChapterError } from "@/server/chapters";
import { gameState } from "@/server/quiz";
import { Live } from "./live";

export const metadata: Metadata = { title: "Quiz night" };

export default async function Game({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  let s;
  try {
    s = await gameState(user.id, id);
  } catch (e) {
    if (e instanceof ChapterError) notFound();
    throw e;
  }
  return <Live initial={s} />;
}
