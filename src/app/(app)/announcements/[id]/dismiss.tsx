"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { dismissAnnouncement } from "@/app/actions/plan";

export function DismissButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" disabled={pending} onClick={() => start(async () => { await dismissAnnouncement(id); router.push("/"); })}>
      Got it, hide from Home
    </Button>
  );
}
