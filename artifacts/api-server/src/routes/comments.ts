import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  commentsTable,
  songsTable,
  profilesTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../lib/auth";
import { toComment } from "../lib/shapes";

const router: IRouter = Router();

const PostCommentBody = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty")
    .max(2000, "Comment must be 2000 characters or fewer"),
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

    const [song] = await db
      .select({ id: songsTable.id })
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
        body: parsed.data.body,
      })
      .returning();

    const [author] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, profile.id))
      .limit(1);

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
    res.status(204).end();
  },
);

export default router;
