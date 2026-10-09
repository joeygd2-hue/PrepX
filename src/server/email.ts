import "server-only";
import { db, schema } from "@/db";
import { env } from "@/lib/env";

type Mail = { to: string; template: string; subject: string; text: string };

/**
 * Sends transactional email. In development (EMAIL_PROVIDER=console) the message is
 * written to the server log and the email_log table so it can be read locally; this
 * provider is refused in production so codes are never silently dropped or exposed.
 */
export async function sendEmail(mail: Mail) {
  if (env.email.provider === "console") {
    if (env.isProd) throw new Error("EMAIL_PROVIDER=console is not allowed in production");
    console.info(`[email:console] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
    await db.insert(schema.emailLog).values({ ...mail, body: mail.text, status: "logged" });
    return;
  }
  if (env.email.provider === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.email.resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.email.from, to: mail.to, subject: mail.subject, text: mail.text }),
    });
    // Bodies are not stored for real deliveries (they may contain codes).
    await db.insert(schema.emailLog).values({ to: mail.to, template: mail.template, subject: mail.template, body: null, status: res.ok ? "sent" : "failed" });
    if (!res.ok) throw new Error(`Email provider error ${res.status}`);
    return;
  }
  throw new Error(`Unsupported EMAIL_PROVIDER ${env.email.provider}`);
}
