import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  commentsTable,
  commentReportsTable,
  songsTable,
  profilesTable,
  adminActionsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../lib/auth";
import { toComment } from "../lib/shapes";
import { notifyNewComment } from "../lib/notifications";
import { logger } from "../lib/logger";
import {
  checkRateLimit,
  COMMENT_POST_LIMITS,
  COMMENT_REPORT_LIMITS,
} from "../lib/rateLimit";
import { checkCommentContent } from "../lib/contentFilter";

const router: IRouter = Router();

const PostCommentBody = z.object({
  body: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(2000, "Comment must be 2000 characters or fewer"),
});

const ReportCommentBody = z.object({
  reason: z.string().trim().min(1).max(500),
});

router.get("/songs/:songId/comments", async (req: Request, res: Response) => {
  const songId = req.params.songId as string;
  const [song] = await db
    .select({ id: songsTable.id })
    .from(songsTable)
    .where(eq(songsTable.id, songId))
    .limit(1);
  if (!song) {
    res.status(404).json({ error: "Song not found" });
    return;
  }

  const rows = await db
    .select({ comment: commentsTable, author: profilesTable })
    .from(commentsTable)
    .innerJoin(profilesTable, eq(commentsTable.authorId, profilesTable.id))
    .where(eq(commentsTable.songId, songId))
    .orderBy(desc(commentsTable.createdAt));

  res.json(rows.map((r) => toComment(r.comment, r.author)));
});

router.post(
  "/songs/:songId/comments",
  requireAuth,
  async (req: Request, res: Response) => {
    const songId = req.params.songId as string;
    const parsed = PostCommentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid body",
        details: parsed.error.issues,
      });
      return;
    }
    const profile = (req as Request & { profile: { id: string } }).profile;

    // Per-user rate limit. Returns 429 with Retry-After when exceeded so
    // honest clients can back off and bots get a clear no.
    const rl = checkRateLimit(`comments:post:${profile.id}`, COMMENT_POST_LIMITS);
    if (!rl.ok) {
      res.setHeader("Retry-After", String(rl.retryAfterSec));
      res.status(429).json({
        error: `You're commenting too quickly. Try again in ${rl.retryAfterSec}s.`,
      });
      return;
    }

    // Content filter — blocks the obvious stuff (link floods, repeat
    // spam, all-caps, blocklisted slurs). Anything that gets through can
    // still be reported by the community.
    const filter = checkCommentContent(parsed.data.body);
    if (!filter.ok) {
      res.status(400).json({ error: filter.reason });
      return;
    }

    const [song] = await db
      .select({
        id: songsTable.id,
        slug: songsTable.slug,
        title: songsTable.title,
      })
      .from(songsTable)
      .where(eq(songsTable.id, songId))
      .limit(1);
    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }

    const [created] = await db
      .insert(commentsTable)
      .values({
        songId,
        authorId: profile.id,
        body: filter.sanitized,
      })
      .returning();

    const [author] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, profile.id))
      .limit(1);

    // Fan out notifications best-effort. Never block the response.
    notifyNewComment({
      songId: song.id,
      songSlug: song.slug,
      songTitle: song.title,
      commentId: created!.id,
      commentBody: created!.body,
      authorId: profile.id,
      authorDisplayName: author!.displayName,
    }).catch((err) => {
      logger.warn(
        { err, songId: song.id, commentId: created!.id },
        "notifyNewComment failed",
      );
    });

    res.status(201).json(toComment(created!, author!));
  },
);

router.delete(
  "/comments/:commentId",
  requireAuth,
  async (req: Request, res: Response) => {
    const commentId = req.params.commentId as string;
    const profile = (req as Request & {
      profile: { id: string; isAdmin: boolean };
    }).profile;

    const [existing] = await db
      .select()
      .from(commentsTable)
      .where(eq(commentsTable.id, commentId))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }

    if (existing.authorId !== profile.id && !profile.isAdmin) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db.delete(commentsTable).where(eq(commentsTable.id, commentId));

    // Audit any admin-triggered deletion (including self-authored), so the
    // moderation trail is complete. Author-only deletes of their own
    // comments are not logged.
    if (profile.isAdmin) {
      await db.insert(adminActionsTable).values({
        actorId: profile.id,
        action: "delete_comment",
        payload: JSON.stringify({
          commentId: existing.id,
          songId: existing.songId,
          authorId: existing.authorId,
          selfAuthored: existing.authorId === profile.id,
          body: existing.body.slice(0, 500),
        }),
      });
    }

    res.status(204).end();
  },
);

router.post(
  "/comments/:commentId/reports",
  requireAuth,
  async (req: Request, res: Response) => {
    const commentId = req.params.commentId as string;
    const parsed = ReportCommentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid body",
        details: parsed.error.issues,
      });
      return;
    }
    const profile = (req as Request & { profile: { id: string } }).profile;

    const rl = checkRateLimit(
      `comments:report:${profile.id}`,
      COMMENT_REPORT_LIMITS,
    );
    if (!rl.ok) {
      res.setHeader("Retry-After", String(rl.retryAfterSec));
      res.status(429).json({
        error: `You're reporting too quickly. Try again in ${rl.retryAfterSec}s.`,
      });
      return;
    }

    const [existing] = await db
      .select({ id: commentsTable.id, authorId: commentsTable.authorId })
      .from(commentsTable)
      .where(eq(commentsTable.id, commentId))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }
    if (existing.authorId === profile.id) {
      res.status(400).json({ error: "You can't report your own comment." });
      return;
    }

    try {
      await db.insert(commentReportsTable).values({
        commentId,
        reporterId: profile.id,
        reason: parsed.data.reason,
      });
    } catch (err) {
      // Unique (commentId, reporterId) — treat as success (idempotent).
      const message = err instanceof Error ? err.message : "";
      if (!message.toLowerCase().includes("unique")) {
        throw err;
      }
    }

    res.status(201).json({ ok: true });
  },
);

export default router;
