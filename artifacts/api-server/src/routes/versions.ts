import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  versionsTable,
  versionMergesTable,
  commitsTable,
  profilesTable,
} from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { toVersion, toContributor } from "../lib/shapes";

const router: IRouter = Router();

async function versionsWithMergesForSong(songId: string) {
  const versions = await db
    .select()
    .from(versionsTable)
    .where(eq(versionsTable.songId, songId))
    .orderBy(asc(versionsTable.versionNumber));

  const results = await Promise.all(
    versions.map(async (v) => {
      const merges = await db
        .select({
          merge: versionMergesTable,
          commit: commitsTable,
          contributor: profilesTable,
        })
        .from(versionMergesTable)
        .innerJoin(commitsTable, eq(commitsTable.id, versionMergesTable.commitId))
        .innerJoin(
          profilesTable,
          eq(profilesTable.id, versionMergesTable.contributorId),
        )
        .where(eq(versionMergesTable.versionId, v.id));

      return {
        ...toVersion(v),
        merges: merges.map((m) => ({
          id: m.merge.id,
          versionId: m.merge.versionId,
          commitId: m.merge.commitId,
          contributorId: m.merge.contributorId,
          mergeNote: m.merge.mergeNote ?? null,
          commitTitle: m.commit.title,
          instrumentType: m.commit.instrumentType,
          contributor: toContributor(m.contributor),
          createdAt: m.merge.createdAt.toISOString(),
        })),
      };
    }),
  );
  return results;
}

router.get("/songs/:songId/versions", async (req: Request, res: Response) => {
  res.json(await versionsWithMergesForSong(req.params.songId as string));
});

export { versionsWithMergesForSong };
export default router;
