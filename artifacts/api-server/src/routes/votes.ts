import { Router, type IRouter, type Request, type Response } from "express";
import { db, commitsTable, votesTable, roundsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

async function voteResult(commitId: string, voterId: string) {
  const [counts] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(votesTable)
    .where(eq(votesTable.commitId, commitId));
  const [existing] = await db
    .select()
    .from(votesTable)
    .where(and(eq(votesTable.commitId, commitId), eq(votesTable.voterId, voterId)))
    .limit(1);
  return {
    commitId,
    voteCount: counts?.count ?? 0,
    hasVoted: !!existing,
  };
}

router.post(
  "/commits/:commitId/vote",
  requireAuth,
  async (req: Request, res: Response) => {
    const commitId = req.params.commitId as string;
    const profile = (req as Request & { profile: { id: string } }).profile;

    const [commit] = await db
      .select()
      .from(commitsTable)
      .where(eq(commitsTable.id, commitId))
      .limit(1);
    if (!commit) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [round] = await db
      .select()
      .from(roundsTable)
      .where(eq(roundsTable.id, commit.roundId))
      .limit(1);
    if (round && round.status !== "open") {
      res.status(400).json({ error: "Voting closed for this round" });
      return;
    }
    if (commit.contributorId === profile.id) {
      res.status(400).json({ error: "You cannot vote on your own commit" });
      return;
    }

    await db
      .insert(votesTable)
      .values({ voterId: profile.id, commitId })
      .onConflictDoNothing();

    res.json(await voteResult(commitId, profile.id));
  },
);

router.delete(
  "/commits/:commitId/vote",
  requireAuth,
  async (req: Request, res: Response) => {
    const commitId = req.params.commitId as string;
    const profile = (req as Request & { profile: { id: string } }).profile;

    const [commit] = await db
      .select()
      .from(commitsTable)
      .where(eq(commitsTable.id, commitId))
      .limit(1);
    if (!commit) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [round] = await db
      .select()
      .from(roundsTable)
      .where(eq(roundsTable.id, commit.roundId))
      .limit(1);
    if (round && round.status !== "open") {
      res.status(400).json({ error: "Voting closed for this round" });
      return;
    }

    await db
      .delete(votesTable)
      .where(and(eq(votesTable.commitId, commitId), eq(votesTable.voterId, profile.id)));
    res.json(await voteResult(commitId, profile.id));
  },
);

export default router;
