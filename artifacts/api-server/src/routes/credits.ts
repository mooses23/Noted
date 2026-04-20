import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  versionsTable,
  versionMergesTable,
  commitsTable,
  profilesTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { toContributor } from "../lib/shapes";

const router: IRouter = Router();

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
