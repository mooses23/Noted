import {
  db,
  notificationsTable,
  profilesTable,
  type Notification,
} from "@workspace/db";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { sendEmail } from "./email";
import { logger } from "./logger";

const DEFAULT_APP_BASE_URL =
  process.env.APP_BASE_URL ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "https://noted.app");

const MAX_NOTIFICATIONS_PER_EMAIL = 25;

export interface DigestRunResult {
  candidates: number;
  emailsSent: number;
  emailsFailed: number;
  emailsSkippedNoEmail: number;
  notificationsCovered: number;
  /**
   * Number of recipients where the email was successfully handed off to
   * the transport (or logged in dev) but the post-send DB write that
   * marks notifications as emailed failed. Tracked separately from
   * `emailsFailed` (which counts transport-level failures) so ops can
   * distinguish "the provider rejected us" from "we may double-send next
   * run because we couldn't persist the watermark".
   */
  postSendPersistFailures: number;
}

interface DigestRecipient {
  profile: typeof profilesTable.$inferSelect;
  notifications: Notification[];
}

/**
 * Collect every profile with at least one unread notification that has
 * not yet been included in a digest email. Skips opted-out users; the
 * "no email on file" check is deferred to the send loop so the count is
 * reflected in `emailsSkippedNoEmail`.
 */
async function loadDigestRecipients(): Promise<DigestRecipient[]> {
  // Pull every unread notification that hasn't yet been included in a
  // digest email, joined to its recipient. We then group in memory —
  // recipient counts stay small in practice because the same profile
  // authors the bulk of notifications and the digest job runs at most
  // daily. Filtering on `emailedAt` (rather than the per-profile
  // watermark) means the digest tracks per-row delivery, so backfilled
  // or out-of-order notifications still get picked up exactly once.
  const rows = await db
    .select({
      n: notificationsTable,
      p: profilesTable,
    })
    .from(notificationsTable)
    .innerJoin(profilesTable, eq(profilesTable.id, notificationsTable.userId))
    .where(
      and(
        isNull(notificationsTable.readAt),
        isNull(notificationsTable.emailedAt),
        eq(profilesTable.unreadDigestOptOut, false),
      ),
    )
    .orderBy(asc(notificationsTable.createdAt));

  const byProfile = new Map<string, DigestRecipient>();
  for (const row of rows) {
    const existing = byProfile.get(row.p.id);
    if (existing) {
      existing.notifications.push(row.n);
    } else {
      byProfile.set(row.p.id, { profile: row.p, notifications: [row.n] });
    }
  }
  return Array.from(byProfile.values());
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderDigest(
  recipient: DigestRecipient,
  baseUrl: string,
): { subject: string; html: string; text: string } {
  const visible = recipient.notifications.slice(0, MAX_NOTIFICATIONS_PER_EMAIL);
  const overflow = recipient.notifications.length - visible.length;
  const total = recipient.notifications.length;

  const subject =
    total === 1
      ? `1 unread update on Noted`
      : `${total} unread updates on Noted`;

  const items = visible
    .map((n) => {
      const link = `${baseUrl}${n.linkPath}`;
      const body = n.body ? `<div style="color:#666;font-size:13px;margin-top:4px">${escapeHtml(n.body)}</div>` : "";
      return `<li style="margin:0 0 16px 0;line-height:1.4">
        <a href="${link}" style="color:#111;text-decoration:none;font-weight:600">${escapeHtml(n.title)}</a>
        ${body}
      </li>`;
    })
    .join("");

  const overflowLine =
    overflow > 0
      ? `<p style="color:#666;font-size:13px">…and ${overflow} more on your bell.</p>`
      : "";

  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#fafafa;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #eee;padding:24px">
      <h1 style="font-size:18px;margin:0 0 16px 0">Hi ${escapeHtml(recipient.profile.displayName)},</h1>
      <p style="color:#444;font-size:14px;margin:0 0 16px 0">
        While you were away, ${total} update${total === 1 ? "" : "s"} landed in your bell on Noted.
      </p>
      <ul style="list-style:none;padding:0;margin:0">${items}</ul>
      ${overflowLine}
      <p style="color:#999;font-size:12px;margin-top:24px">
        You can <a href="${baseUrl}/profile" style="color:#999">turn off this digest</a> on your profile at any time.
      </p>
    </div>
  </body></html>`;

  const textLines = [
    `Hi ${recipient.profile.displayName},`,
    "",
    `${total} update${total === 1 ? "" : "s"} landed in your bell on Noted:`,
    "",
    ...visible.map((n) => `• ${n.title}\n  ${baseUrl}${n.linkPath}`),
    overflow > 0 ? `\n…and ${overflow} more on your bell.` : "",
    "",
    `Turn off this digest: ${baseUrl}/profile`,
  ];
  const text = textLines.filter((l) => l !== undefined).join("\n");

  return { subject, html, text };
}

/**
 * Run a digest pass: send one email per eligible user covering every
 * unread notification that has not yet been included in a digest. After
 * a successful send we stamp `notifications.emailedAt` on every covered
 * row so subsequent runs skip them, and bump
 * `profiles.lastDigestEmailedAt` as an informational "last sent"
 * timestamp (no longer used to filter eligibility).
 */
export async function runDigestJob(
  baseUrl: string = DEFAULT_APP_BASE_URL,
): Promise<DigestRunResult> {
  const recipients = await loadDigestRecipients();
  const result: DigestRunResult = {
    candidates: recipients.length,
    emailsSent: 0,
    emailsFailed: 0,
    emailsSkippedNoEmail: 0,
    notificationsCovered: 0,
    postSendPersistFailures: 0,
  };

  for (const recipient of recipients) {
    if (!recipient.profile.email) {
      result.emailsSkippedNoEmail += 1;
      continue;
    }
    const { subject, html, text } = renderDigest(recipient, baseUrl);
    const send = await sendEmail({
      to: recipient.profile.email,
      subject,
      html,
      text,
    });
    if (send.delivered) {
      result.emailsSent += 1;
      result.notificationsCovered += recipient.notifications.length;
    } else if (send.provider === "log") {
      // No real send; still mark notifications as emailed so dev runs converge.
      result.emailsSent += 1;
      result.notificationsCovered += recipient.notifications.length;
    } else {
      result.emailsFailed += 1;
      logger.warn(
        { profileId: recipient.profile.id, error: send.error },
        "digest: email send failed; not marking notifications as emailed",
      );
      continue;
    }
    // Mark every covered notification as emailed so subsequent runs skip
    // them. This is independent of `readAt` — a user reading a notification
    // in-app does not mark it emailed, and being included in a digest does
    // not mark it read.
    const ids = recipient.notifications.map((n) => n.id);
    const now = new Date();
    try {
      await db
        .update(notificationsTable)
        .set({ emailedAt: now })
        .where(
          and(
            inArray(notificationsTable.id, ids),
            isNull(notificationsTable.emailedAt),
          ),
        );
      // Keep the per-profile watermark up to date for analytics/UI; the
      // digest filter itself relies on `emailedAt`, so this is purely
      // informational and a failure here is non-fatal.
      await db
        .update(profilesTable)
        .set({ lastDigestEmailedAt: now, updatedAt: now })
        .where(eq(profilesTable.id, recipient.profile.id));
    } catch (err) {
      // The email itself succeeded, so we leave `emailsSent` alone and
      // surface the persistence failure on its own counter — otherwise
      // ops can't distinguish a transport-level reject from a "we sent
      // it but couldn't record it" case.
      result.postSendPersistFailures += 1;
      logger.error(
        { err, profileId: recipient.profile.id },
        "digest: failed to mark notifications as emailed; some may be re-sent next run",
      );
    }
  }

  logger.info({ ...result }, "digest: run complete");
  return result;
}
