import { logger } from "./logger";

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  delivered: boolean;
  provider: "resend" | "log";
  id?: string | null;
  error?: string;
}

/**
 * Minimal email sender. Uses Resend's HTTP API when RESEND_API_KEY is
 * present (no SDK dependency to keep the bundle small) and otherwise logs
 * the message at info level so digests can be exercised in dev / CI.
 */
export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM_EMAIL ?? "Noted <notifications@noted.app>";

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      // Refuse to silently swallow real digests in production.
      logger.error(
        { to: args.to, subject: args.subject },
        "email.sendEmail: RESEND_API_KEY missing in production — email NOT sent",
      );
      return {
        delivered: false,
        provider: "resend",
        error: "RESEND_API_KEY not configured",
      };
    }
    logger.info(
      { to: args.to, subject: args.subject },
      "email.sendEmail: RESEND_API_KEY not set — logging email instead of sending (dev only)",
    );
    return { delivered: false, provider: "log" };
  }

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      logger.warn(
        { to: args.to, status: resp.status, body },
        "email.sendEmail: Resend rejected request",
      );
      return {
        delivered: false,
        provider: "resend",
        error: `Resend ${resp.status}: ${body.slice(0, 200)}`,
      };
    }
    const json = (await resp.json()) as { id?: string };
    return { delivered: true, provider: "resend", id: json.id ?? null };
  } catch (err) {
    logger.error({ err, to: args.to }, "email.sendEmail: network error");
    return {
      delivered: false,
      provider: "resend",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
