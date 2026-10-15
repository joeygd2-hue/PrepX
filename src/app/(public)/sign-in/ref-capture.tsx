"use client";
import { useEffect } from "react";

/** Remembers an invite code for 30 days so it can be credited after sign-up. */
export function RefCapture({ code }: { code: string }) {
  useEffect(() => {
    if (/^[A-Z0-9]{6,12}$/i.test(code)) document.cookie = `prepx_ref=${encodeURIComponent(code)}; Max-Age=${30 * 86400}; Path=/; SameSite=Lax`;
  }, [code]);
  return null;
}
