import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  songsTable,
  songCreditsTable,
  versionsTable,
  versionMergesTable,
  commitsTable,
  profilesTable,
} from "@workspace/db";
import { eq, asc, desc } from "drizzle-orm";
import { toContributor, toSongCredit } from "../lib/shapes";

const router: IRouter = Router();

router.get("/credits", async (_req: Request, res: Response) => {
  const rows = await db
    .select({ credit: songCreditsTable, song: songsTable })
    .from(songCreditsTable)
    .innerJoin(songsTable, eq(songsTable.id, songCreditsTable.songId))
    .orderBy(
      asc(songsTable.title),
      asc(songCreditsTable.sortOrder),
      asc(songCreditsTable.createdAt),
    );

  res.json(
    rows.map((r) => ({
      ...toSongCredit(r.credit),
      song: { id: r.song.id, slug: r.song.slug, title: r.song.title },
    })),
  );
});

router.get("/songs/:songId/credits", async (req: Request, res: Response) => {
  const rows = await db
    .select({
      merge: versionMergesTable,
      commit: commitsTable,
      contributor: profilesTable,
      version: versionsTable,
    })
    .from(versionMergesTable)
    .innerJoin(versionsTable, eq(versionsTable.id, versionMergesTable.versionId))
    .innerJoin(commitsTable, eq(commitsTable.id, versionMergesTable.commitId))
    .innerJoin(profilesTable, eq(profilesTable.id, versionMergesTable.contributorId))
    .where(eq(versionsTable.songId, req.params.songId as string))
    .orderBy(desc(versionMergesTable.createdAt));

  res.json(
    rows.map((r) => ({
      contributor: toContributor(r.contributor),
      commitId: r.commit.id,
      commitTitle: r.commit.title,
      instrumentType: r.commit.instrumentType,
      versionNumber: r.version.versionNumber,
      versionId: r.version.id,
      versionTitle: r.version.title,
      mergeNote: r.merge.mergeNote ?? null,
      mergedAt: r.merge.createdAt.toISOString(),
    })),
  );
});

export default router;
