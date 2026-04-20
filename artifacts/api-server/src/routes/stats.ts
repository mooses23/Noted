import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  songsTable,
  commitsTable,
  votesTable,
  versionMergesTable,
  roundsTable,
  profilesTable,
  downloadsLogTable,
  songFilesTable,
} from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { toContributor } from "../lib/shapes";

const router: IRouter = Router();

router.post("/downloads/log", async (req: Request, res: Response) => {
  const { songId, fileId } = req.body ?? {};
  if (!songId || !fileId) {
    res.status(400).json({ error: "songId and fileId required" });
    return;
  }
  try {
    await db.insert(downloadsLogTable).values({ songId, fileId });
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

router.get("/stats/public", async (_req: Request, res: Response) => {
  const [songs, commits, votes, mergedContribs, genreRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(songsTable),
    db.select({ count: sql<number>`count(*)::int` }).from(commitsTable),
    db.select({ count: sql<number>`count(*)::int` }).from(votesTable),
    db
      .select({
        count: sql<number>`count(distinct ${versionMergesTable.contributorId})::int`,
      })
      .from(versionMergesTable),
    db
      .select({
        genre: songsTable.genre,
        songCount: sql<number>`count(distinct ${songsTable.id})::int`,
        commitCount: sql<number>`count(${commitsTable.id})::int`,
      })
      .from(songsTable)
      .leftJoin(commitsTable, eq(commitsTable.songId, songsTable.id))
      .groupBy(songsTable.genre),
  ]);

  res.json({
    totalSongs: songs[0]?.count ?? 0,
    totalCommits: commits[0]?.count ?? 0,
    totalVotes: votes[0]?.count ?? 0,
    totalMergedContributors: mergedContribs[0]?.count ?? 0,
    genres: genreRows,
  });
});

router.get("/stats/admin", requireAdmin, async (_req: Request, res: Response) => {
  const [subs, votes, activeRounds, pending, topRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(commitsTable),
    db.select({ count: sql<number>`count(*)::int` }).from(votesTable),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(roundsTable)
      .where(eq(roundsTable.status, "open")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(commitsTable)
      .where(eq(commitsTable.status, "pending")),
    db
      .select({
        profile: profilesTable,
        mergedCount: sql<number>`(
          select count(*)::int from ${versionMergesTable}
          where ${versionMergesTable.contributorId} = ${profilesTable.id}
        )`,
        totalCommits: sql<number>`(
          select count(*)::int from ${commitsTable}
          where ${commitsTable.contributorId} = ${profilesTable.id}
        )`,
        totalVotes: sql<number>`(
          select count(${votesTable.id})::int from ${votesTable}
          join ${commitsTable} on ${commitsTable.id} = ${votesTable.commitId}
          where ${commitsTable.contributorId} = ${profilesTable.id}
        )`,
      })
      .from(profilesTable)
      .orderBy(
        desc(sql`(
          select count(*) from ${versionMergesTable}
          where ${versionMergesTable.contributorId} = ${profilesTable.id}
        )`),
      )
      .limit(10),
  ]);

  res.json({
    totalSubmissions: subs[0]?.count ?? 0,
    totalVotes: votes[0]?.count ?? 0,
    activeRounds: activeRounds[0]?.count ?? 0,
    pendingCommits: pending[0]?.count ?? 0,
    topContributors: topRows
      .filter((r) => r.totalCommits > 0 || r.mergedCount > 0)
      .map((r) => ({
        contributor: toContributor(r.profile),
        mergedCount: r.mergedCount,
        totalCommits: r.totalCommits,
        totalVotes: r.totalVotes,
      })),
  });
});

export default router;
