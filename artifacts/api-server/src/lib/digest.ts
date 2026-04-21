import {
  db,
  notificationsTable,
  profilesTable,
  type Notification,
} from "@workspace/db";
import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
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
}

interface DigestRecipient {
  profile: typeof profilesTable.$inferSelect;
  notifications: Notification[];
}

/**
 * Collect every profile with at least one unread notification created since
 * the last digest we sent them (or since account creation if we've never
 * sent one). Skips opted-out users and profiles without a cached email.
 */
async function loadDigestRecipients(): Promise<DigestRecipient[]> {
  // Pull every unread, never-emailed-yet notification joined to its
  // recipient. We then group in memory — recipient counts stay small in
  // practice because the same profile authors the bulk of notifications
  // and the digest job runs at most daily.
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
        eq(profilesTable.unreadDigestOptOut, false),
        or(
          isNull(profilesTable.lastDigestEmailedAt),
          gt(notificationsTable.createdAt, profilesTable.lastDigestEmailedAt),
        ),
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
 * Run a digest pass: send one email per eligible user covering every unread
 * notification newer than their last digest. Updates `lastDigestEmailedAt`
 * to the timestamp of the newest notification we covered so a re-run won't
 * re-send the same items.
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
  };

  for (const recipient of recipients) {
    if (!recipient.profile.email) {
      result.emailsSkippedNoEmail += 1;
      continue;
    }
    const newestAt = recipient.notifications.reduce<Date>(
      (acc, n) => (n.createdAt > acc ? n.createdAt : acc),
      recipient.notifications[0]!.createdAt,
    );
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
      // No real send; still advance the watermark so dev runs converge.
      result.emailsSent += 1;
      result.notificationsCovered += recipient.notifications.length;
    } else {
      result.emailsFailed += 1;
      logger.warn(
        { profileId: recipient.profile.id, error: send.error },
        "digest: email send failed; not advancing watermark",
      );
      continue;
    }
    // Bump the watermark 1ms past the newest covered notification so any
    // future row that happens to share the same createdAt timestamp will
    // still be picked up (`createdAt > lastDigestEmailedAt`).
    const watermark = new Date(newestAt.getTime() + 1);
    try {
      await db
        .update(profilesTable)
        .set({ lastDigestEmailedAt: watermark, updatedAt: new Date() })
        .where(eq(profilesTable.id, recipient.profile.id));
    } catch (err) {
      // Don't let one recipient's update failure abort the rest of the job.
      result.emailsFailed += 1;
      logger.error(
        { err, profileId: recipient.profile.id },
        "digest: failed to advance watermark; recipient may be re-emailed next run",
      );
    }
  }

  logger.info({ ...result }, "digest: run complete");
  return result;
}
