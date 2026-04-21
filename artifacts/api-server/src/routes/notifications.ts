import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  notificationsTable,
  profilesTable,
  songsTable,
} from "@workspace/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { toContributor } from "../lib/shapes";

const router: IRouter = Router();

router.get(
  "/me/notifications",
  requireAuth,
  async (req: Request, res: Response) => {
    const profile = (req as Request & { profile: { id: string } }).profile;
    const rows = await db
      .select({
        n: notificationsTable,
        actor: profilesTable,
        song: songsTable,
      })
      .from(notificationsTable)
      .leftJoin(profilesTable, eq(notificationsTable.actorId, profilesTable.id))
      .leftJoin(songsTable, eq(notificationsTable.songId, songsTable.id))
      .where(eq(notificationsTable.userId, profile.id))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.userId, profile.id),
          isNull(notificationsTable.readAt),
        ),
      );

    res.json({
      unreadCount: Number(count ?? 0),
      items: rows.map((r) => ({
        id: r.n.id,
        type: r.n.type,
        title: r.n.title,
        body: r.n.body,
        linkPath: r.n.linkPath,
        readAt: r.n.readAt ? r.n.readAt.toISOString() : null,
        createdAt: r.n.createdAt.toISOString(),
        actor: r.actor ? toContributor(r.actor) : null,
        songId: r.n.songId,
        songTitle: r.song?.title ?? null,
        commentId: r.n.commentId,
      })),
    });
  },
);

router.post(
  "/me/notifications/read-all",
  requireAuth,
  async (req: Request, res: Response) => {
    const profile = (req as Request & { profile: { id: string } }).profile;
    await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.userId, profile.id),
          isNull(notificationsTable.readAt),
        ),
      );
    res.status(204).end();
  },
);

router.post(
  "/me/notifications/:id/read",
  requireAuth,
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const profile = (req as Request & { profile: { id: string } }).profile;
    await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.id, id),
          eq(notificationsTable.userId, profile.id),
        ),
      );
    res.status(204).end();
  },
);

export default router;
