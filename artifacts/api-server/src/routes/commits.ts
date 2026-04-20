import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  commitsTable,
  roundsTable,
  songsTable,
  profilesTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { getSessionProfile, requireAuth } from "../lib/auth";
import { fetchCommitRows, fetchCommitById, fetchMergedVersionForCommit } from "../lib/commitQueries";
import { toCommitSummary, toRound, toVersion } from "../lib/shapes";
import { SubmitCommitBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/commits/rising", async (req: Request, res: Response) => {
  const voter = await getSessionProfile(req);
  const limit = Math.min(parseInt(String(req.query.limit ?? "6"), 10) || 6, 50);
  const genre = typeof req.query.genre === "string" ? req.query.genre : undefined;

  const conds = [eq(roundsTable.status, "open")];
  if (genre) conds.push(eq(songsTable.genre, genre));

  const rows = await fetchCommitRows(and(...conds), {
    voterId: voter?.id,
    sort: "top",
    limit,
  });
  res.json(rows.map(toCommitSummary));
});

router.get("/commits", async (req: Request, res: Response) => {
  const voter = await getSessionProfile(req);
  const conds = [];
  if (typeof req.query.songId === "string")
    conds.push(eq(commitsTable.songId, req.query.songId));
  if (typeof req.query.roundId === "string")
    conds.push(eq(commitsTable.roundId, req.query.roundId));
  if (typeof req.query.status === "string")
    conds.push(eq(commitsTable.status, req.query.status as "pending" | "shortlisted" | "merged" | "rejected"));
  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
  const sort = req.query.sort === "top" ? "top" : "newest";

  const rows = await fetchCommitRows(conds.length ? and(...conds) : undefined, {
    voterId: voter?.id,
    sort,
    limit,
  });
  res.json(rows.map(toCommitSummary));
});

router.get("/rounds/:roundId/commits", async (req: Request, res: Response) => {
  const voter = await getSessionProfile(req);
  const sort = req.query.sort === "newest" ? "newest" : "top";
  const rows = await fetchCommitRows(eq(commitsTable.roundId, req.params.roundId as string), {
    voterId: voter?.id,
    sort,
  });
  res.json(rows.map(toCommitSummary));
});

router.get("/commits/:commitId", async (req: Request, res: Response) => {
  const voter = await getSessionProfile(req);
  const row = await fetchCommitById(req.params.commitId as string, voter?.id);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const mergedVersion = await fetchMergedVersionForCommit(row.commit.id);
  res.json({
    ...toCommitSummary(row),
    round: toRound(row.round),
    mergedIntoVersion: mergedVersion ? toVersion(mergedVersion) : null,
  });
});

router.post("/commits/submit", requireAuth, async (req: Request, res: Response) => {
  const parsed = SubmitCommitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }
  const body = parsed.data;
  if (!body.confirmedHumanMade || !body.confirmedRightsGrant) {
    res.status(400).json({
      error: "Both human-made and rights-grant confirmations are required.",
    });
    return;
  }

  const profile = (req as Request & { profile: { id: string } }).profile;

  const [round] = await db
    .select()
    .from(roundsTable)
    .where(eq(roundsTable.id, body.roundId))
    .limit(1);
  if (!round) {
    res.status(404).json({ error: "Round not found" });
    return;
  }
  if (round.status !== "open") {
    res.status(400).json({ error: "Round is not open for submissions" });
    return;
  }
  if (round.allowedInstrumentType !== body.instrumentType) {
    res.status(400).json({
      error: `This round only accepts '${round.allowedInstrumentType}' submissions.`,
    });
    return;
  }

  const [existing] = await db
    .select({ id: commitsTable.id })
    .from(commitsTable)
    .where(
      and(
        eq(commitsTable.roundId, round.id),
        eq(commitsTable.contributorId, profile.id),
      ),
    )
    .limit(1);
  if (existing) {
    res.status(409).json({
      error: "You have already submitted a commit to this round.",
    });
    return;
  }

  // Optional: update profile social handle / display override
  if (body.displayNameOverride || body.socialHandle) {
    await db
      .update(profilesTable)
      .set({
        ...(body.displayNameOverride
          ? { displayName: body.displayNameOverride }
          : {}),
        ...(body.socialHandle ? { socialHandle: body.socialHandle } : {}),
        updatedAt: new Date(),
      })
      .where(eq(profilesTable.id, profile.id));
  }

  const [created] = await db
    .insert(commitsTable)
    .values({
      songId: round.songId,
      roundId: round.id,
      contributorId: profile.id,
      title: body.title,
      note: body.note ?? null,
      instrumentType: body.instrumentType,
      audioFileUrl: body.audioObjectPath,
      status: "pending",
      confirmedHumanMade: true,
      confirmedRightsGrant: true,
    })
    .returning();

  const row = await fetchCommitById(created!.id, profile.id);
  if (!row) {
    res.status(500).json({ error: "Failed to load created commit" });
    return;
  }
  res.json({
    ...toCommitSummary(row),
    round: toRound(row.round),
    mergedIntoVersion: null,
  });
});

export default router;
