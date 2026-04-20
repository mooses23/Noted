import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  roundsTable,
  commitsTable,
  votesTable,
} from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { toRound } from "../lib/shapes";

const router: IRouter = Router();

router.get("/songs/:songId/rounds", async (req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(roundsTable)
    .where(eq(roundsTable.songId, req.params.songId as string))
    .orderBy(desc(roundsTable.roundNumber));

  const withStats = await Promise.all(
    rows.map(async (r) => {
      const [stats] = await db
        .select({
          commitCount: sql<number>`count(distinct ${commitsTable.id})::int`,
          totalVotes: sql<number>`count(${votesTable.id})::int`,
        })
        .from(commitsTable)
        .leftJoin(votesTable, eq(votesTable.commitId, commitsTable.id))
        .where(eq(commitsTable.roundId, r.id));
      return toRound(r, {
        commitCount: stats?.commitCount ?? 0,
        totalVotes: stats?.totalVotes ?? 0,
      });
    }),
  );
  res.json(withStats);
});

router.get("/rounds/:roundId", async (req: Request, res: Response) => {
  const [r] = await db
    .select()
    .from(roundsTable)
    .where(eq(roundsTable.id, req.params.roundId as string))
    .limit(1);
  if (!r) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [stats] = await db
    .select({
      commitCount: sql<number>`count(distinct ${commitsTable.id})::int`,
      totalVotes: sql<number>`count(${votesTable.id})::int`,
    })
    .from(commitsTable)
    .leftJoin(votesTable, eq(votesTable.commitId, commitsTable.id))
    .where(eq(commitsTable.roundId, r.id));
  res.json(
    toRound(r, {
      commitCount: stats?.commitCount ?? 0,
      totalVotes: stats?.totalVotes ?? 0,
    }),
  );
});

export default router;
