import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  commitsTable,
  roundsTable,
  songsTable,
  profilesTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getSessionProfile, requireAuth } from "../lib/auth";
import { fetchCommitRows, fetchCommitById, fetchMergedVersionForCommit } from "../lib/commitQueries";
import { toCommitSummary, toRound, toVersion } from "../lib/shapes";
import { SubmitCommitBody } from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const CommitsListQuery = z.object({
  songId: z.string().min(1).optional(),
  roundId: z.string().min(1).optional(),
  status: z
    .enum(["pending", "shortlisted", "merged", "rejected"], {
      errorMap: () => ({
        message:
          "status must be one of: pending, shortlisted, merged, rejected",
      }),
    })
    .optional(),
  sort: z
    .enum(["top", "newest"], {
      errorMap: () => ({ message: "sort must be one of: top, newest" }),
    })
    .optional(),
  limit: z.coerce
    .number({ invalid_type_error: "limit must be a number" })
    .int("limit must be an integer")
    .min(1, "limit must be at least 1")
    .max(200, "limit must be 200 or less")
    .optional(),
});

const RisingCommitsQuery = z.object({
  genre: z.string().min(1).optional(),
  limit: z.coerce
    .number({ invalid_type_error: "limit must be a number" })
    .int("limit must be an integer")
    .min(1, "limit must be at least 1")
    .max(50, "limit must be 50 or less")
    .optional(),
});

const RoundCommitsQuery = z.object({
  sort: z
    .enum(["top", "newest"], {
      errorMap: () => ({ message: "sort must be one of: top, newest" }),
    })
    .optional(),
});

const MAX_COMMIT_AUDIO_BYTES = 60 * 1024 * 1024; // 60MB
const ALLOWED_COMMIT_AUDIO_PREFIXES = ["audio/"];
const objectStorage = new ObjectStorageService();

const router: IRouter = Router();

router.get("/commits/rising", async (req: Request, res: Response) => {
  const parsed = RisingCommitsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid query parameters",
      details: parsed.error.issues,
    });
    return;
  }
  const { genre, limit: limitInput } = parsed.data;
  const voter = await getSessionProfile(req);
  const limit = limitInput ?? 6;

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
  const parsed = CommitsListQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid query parameters",
      details: parsed.error.issues,
    });
    return;
  }
  const { songId, roundId, status, sort: sortInput, limit: limitInput } = parsed.data;
  const voter = await getSessionProfile(req);
  const conds = [];
  if (songId) conds.push(eq(commitsTable.songId, songId));
  if (roundId) conds.push(eq(commitsTable.roundId, roundId));
  if (status) conds.push(eq(commitsTable.status, status));
  const limit = limitInput ?? 50;
  const sort = sortInput ?? "newest";

  const rows = await fetchCommitRows(conds.length ? and(...conds) : undefined, {
    voterId: voter?.id,
    sort,
    limit,
  });
  res.json(rows.map(toCommitSummary));
});

router.get("/rounds/:roundId/commits", async (req: Request, res: Response) => {
  const parsed = RoundCommitsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid query parameters",
      details: parsed.error.issues,
    });
    return;
  }
  const voter = await getSessionProfile(req);
  const sort = parsed.data.sort ?? "top";
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

  // Enforce that audioObjectPath points to an audio file under this song+round's
  // expected prefix (prevents clients from linking arbitrary objects).
  const expectedPrefix = `/objects/songs/${round.songId}/rounds/${round.id}/commits/`;
  if (!body.audioObjectPath.startsWith(expectedPrefix)) {
    res.status(400).json({
      error: "audioObjectPath must be an upload for this song and round.",
    });
    return;
  }
  try {
    const objectFile = await objectStorage.getObjectEntityFile(body.audioObjectPath);
    const [meta] = await objectFile.getMetadata();
    const size = typeof meta.size === "string" ? parseInt(meta.size, 10) : Number(meta.size ?? 0);
    const contentType = String(meta.contentType ?? "");
    if (!size || size > MAX_COMMIT_AUDIO_BYTES) {
      res.status(400).json({
        error: `Audio file too large. Max ${MAX_COMMIT_AUDIO_BYTES} bytes.`,
      });
      return;
    }
    if (!ALLOWED_COMMIT_AUDIO_PREFIXES.some((p) => contentType.startsWith(p))) {
      res.status(400).json({
        error: "Uploaded file must be an audio/* content type.",
      });
      return;
    }
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(400).json({ error: "Uploaded audio object not found." });
      return;
    }
    throw err;
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
      kind: round.kind,
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
