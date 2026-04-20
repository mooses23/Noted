import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  songsTable,
  songFilesTable,
  roundsTable,
  versionsTable,
  commitsTable,
  votesTable,
} from "@workspace/db";
import { and, eq, desc, sql } from "drizzle-orm";
import { toSong, toSongFile, toRound, toVersion } from "../lib/shapes";

const router: IRouter = Router();

router.get("/songs", async (req: Request, res: Response) => {
  const genre = typeof req.query.genre === "string" ? req.query.genre : undefined;
  const status =
    typeof req.query.status === "string"
      ? (req.query.status as "draft" | "active" | "archived")
      : undefined;
  const conditions = [];
  if (genre) conditions.push(eq(songsTable.genre, genre));
  if (status) conditions.push(eq(songsTable.status, status));

  const rows = await db
    .select()
    .from(songsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(songsTable.createdAt));
  res.json(rows.map(toSong));
});

async function buildSongDetail(song: typeof songsTable.$inferSelect) {
  const [files, rounds, versions, commitStats, voteStats] = await Promise.all([
    db
      .select()
      .from(songFilesTable)
      .where(eq(songFilesTable.songId, song.id)),
    db
      .select()
      .from(roundsTable)
      .where(eq(roundsTable.songId, song.id))
      .orderBy(desc(roundsTable.roundNumber)),
    db
      .select()
      .from(versionsTable)
      .where(eq(versionsTable.songId, song.id))
      .orderBy(desc(versionsTable.versionNumber)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(commitsTable)
      .where(eq(commitsTable.songId, song.id)),
    db
      .select({ count: sql<number>`count(${votesTable.id})::int` })
      .from(votesTable)
      .innerJoin(commitsTable, eq(commitsTable.id, votesTable.commitId))
      .where(eq(commitsTable.songId, song.id)),
  ]);

  const currentRound = rounds.find((r) => r.status === "open") ?? null;
  const currentVersion = song.currentVersionId
    ? versions.find((v) => v.id === song.currentVersionId) ?? null
    : versions.find((v) => v.isCurrent) ?? versions[0] ?? null;

  const stems = files.filter((f) => f.fileType === "stem");

  return {
    ...toSong(song),
    currentRound: currentRound ? toRound(currentRound) : null,
    currentVersion: currentVersion ? toVersion(currentVersion) : null,
    stems: stems.map(toSongFile),
    totalCommits: commitStats[0]?.count ?? 0,
    totalVotes: voteStats[0]?.count ?? 0,
    versionCount: versions.length,
  };
}

router.get("/songs/featured", async (_req: Request, res: Response) => {
  const [featured] = await db
    .select()
    .from(songsTable)
    .where(and(eq(songsTable.featured, true), eq(songsTable.status, "active")))
    .orderBy(desc(songsTable.createdAt))
    .limit(1);

  const song =
    featured ??
    (
      await db
        .select()
        .from(songsTable)
        .where(eq(songsTable.status, "active"))
        .orderBy(desc(songsTable.createdAt))
        .limit(1)
    )[0];

  if (!song) {
    res.json({ song: null });
    return;
  }
  res.json({ song: await buildSongDetail(song) });
});

router.get("/songs/:songId", async (req: Request, res: Response) => {
  const [song] = await db
    .select()
    .from(songsTable)
    .where(eq(songsTable.id, req.params.songId as string))
    .limit(1);
  if (!song) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(await buildSongDetail(song));
});

router.get("/songs/by-slug/:slug", async (req: Request, res: Response) => {
  const [song] = await db
    .select()
    .from(songsTable)
    .where(eq(songsTable.slug, req.params.slug as string))
    .limit(1);
  if (!song) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(await buildSongDetail(song));
});

router.get("/songs/:songId/files", async (req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(songFilesTable)
    .where(eq(songFilesTable.songId, req.params.songId as string));
  res.json(rows.map(toSongFile));
});

export default router;
