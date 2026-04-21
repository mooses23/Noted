import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  commitDraftsTable,
  commitsTable,
  roundsTable,
  songsTable,
  profilesTable,
  type CommitDraft,
  type Round,
  type Song,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../lib/auth";
import { fetchCommitById } from "../lib/commitQueries";
import { toCommitSummary, toRound, toSong } from "../lib/shapes";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const MAX_COMMIT_AUDIO_BYTES = 60 * 1024 * 1024; // 60MB
const ALLOWED_COMMIT_AUDIO_PREFIXES = ["audio/"];
const objectStorage = new ObjectStorageService();

const router: IRouter = Router();

const CreateDraftBody = z.object({
  songId: z.string().uuid(),
  title: z.string().min(1).max(120),
  note: z.string().max(500).optional(),
  instrumentType: z.string().min(1),
  audioObjectPath: z.string().min(1),
  overlayOffsetSeconds: z.number().min(0).optional(),
  displayNameOverride: z.string().optional(),
  socialHandle: z.string().optional(),
  confirmedHumanMade: z.boolean(),
  confirmedRightsGrant: z.boolean(),
});

const UpdateDraftBody = z.object({
  title: z.string().min(1).max(120).optional(),
  note: z.string().max(500).nullable().optional(),
  instrumentType: z.string().min(1).optional(),
  audioObjectPath: z.string().min(1).optional(),
  overlayOffsetSeconds: z.number().min(0).optional(),
  displayNameOverride: z.string().optional(),
  socialHandle: z.string().optional(),
});

async function validateAudioObjectPath(
  songId: string,
  audioObjectPath: string,
): Promise<string | null> {
  const draftPrefix = `/objects/songs/${songId}/drafts/commits/`;
  const roundPrefix = `/objects/songs/${songId}/rounds/`;
  if (
    !audioObjectPath.startsWith(draftPrefix) &&
    !audioObjectPath.startsWith(roundPrefix)
  ) {
    return "audioObjectPath must be an upload for this song.";
  }
  try {
    const objectFile = await objectStorage.getObjectEntityFile(audioObjectPath);
    const [meta] = await objectFile.getMetadata();
    const size =
      typeof meta.size === "string" ? parseInt(meta.size, 10) : Number(meta.size ?? 0);
    const contentType = String(meta.contentType ?? "");
    if (!size || size > MAX_COMMIT_AUDIO_BYTES) {
      return `Audio file too large. Max ${MAX_COMMIT_AUDIO_BYTES} bytes.`;
    }
    if (!ALLOWED_COMMIT_AUDIO_PREFIXES.some((p) => contentType.startsWith(p))) {
      return "Uploaded file must be an audio/* content type.";
    }
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      return "Uploaded audio object not found.";
    }
    throw err;
  }
  return null;
}

function eligibleRoundFor(
  draft: CommitDraft,
  rounds: Round[],
): Round | null {
  return (
    rounds.find(
      (r) =>
        r.songId === draft.songId &&
        r.status === "open" &&
        r.allowedInstrumentType === draft.instrumentType,
    ) ?? null
  );
}

function toDraft(
  draft: CommitDraft,
  song: Song,
  round: Round | null,
) {
  return {
    id: draft.id,
    songId: draft.songId,
    contributorId: draft.contributorId,
    title: draft.title,
    note: draft.note ?? null,
    instrumentType: draft.instrumentType,
    audioFileUrl: draft.audioFileUrl,
    overlayOffsetSeconds: draft.overlayOffsetSeconds ?? 0,
    displayNameOverride: draft.displayNameOverride ?? null,
    socialHandle: draft.socialHandle ?? null,
    confirmedHumanMade: draft.confirmedHumanMade,
    confirmedRightsGrant: draft.confirmedRightsGrant,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
    song: toSong(song),
    eligibleRound: round ? toRound(round) : null,
  };
}

router.get(
  "/commits/drafts",
  requireAuth,
  async (req: Request, res: Response) => {
    const profile = (req as Request & { profile: { id: string } }).profile;
    const rows = await db
      .select({
        draft: commitDraftsTable,
        song: songsTable,
      })
      .from(commitDraftsTable)
      .innerJoin(songsTable, eq(songsTable.id, commitDraftsTable.songId))
      .where(eq(commitDraftsTable.contributorId, profile.id))
      .orderBy(desc(commitDraftsTable.createdAt));

    const songIds = Array.from(new Set(rows.map((r) => r.draft.songId)));
    const openRounds = songIds.length
      ? await db
          .select()
          .from(roundsTable)
          .where(
            and(eq(roundsTable.status, "open")),
          )
      : [];
    const relevant = openRounds.filter((r) => songIds.includes(r.songId));

    res.json(
      rows.map(({ draft, song }) =>
        toDraft(draft, song, eligibleRoundFor(draft, relevant)),
      ),
    );
  },
);

router.post(
  "/commits/drafts",
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = CreateDraftBody.safeParse(req.body);
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

    const [song] = await db
      .select()
      .from(songsTable)
      .where(eq(songsTable.id, body.songId))
      .limit(1);
    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }

    const audioErr = await validateAudioObjectPath(song.id, body.audioObjectPath);
    if (audioErr) {
      res.status(400).json({ error: audioErr });
      return;
    }

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
      .insert(commitDraftsTable)
      .values({
        songId: song.id,
        contributorId: profile.id,
        title: body.title,
        note: body.note ?? null,
        instrumentType: body.instrumentType,
        audioFileUrl: body.audioObjectPath,
        overlayOffsetSeconds: body.overlayOffsetSeconds ?? 0,
        displayNameOverride: body.displayNameOverride ?? null,
        socialHandle: body.socialHandle ?? null,
        confirmedHumanMade: true,
        confirmedRightsGrant: true,
      })
      .returning();

    const openRounds = await db
      .select()
      .from(roundsTable)
      .where(and(eq(roundsTable.songId, song.id), eq(roundsTable.status, "open")));

    res.json(toDraft(created!, song, eligibleRoundFor(created!, openRounds)));
  },
);

router.patch(
  "/commits/drafts/:draftId",
  requireAuth,
  async (req: Request, res: Response) => {
    const profile = (req as Request & { profile: { id: string } }).profile;
    const draftId = req.params.draftId as string;
    const parsed = UpdateDraftBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }
    const body = parsed.data;

    const [existing] = await db
      .select()
      .from(commitDraftsTable)
      .where(eq(commitDraftsTable.id, draftId))
      .limit(1);
    if (!existing || existing.contributorId !== profile.id) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    // Only re-validate audio when the user is actually replacing it.
    if (
      body.audioObjectPath !== undefined &&
      body.audioObjectPath !== existing.audioFileUrl
    ) {
      const audioErr = await validateAudioObjectPath(
        existing.songId,
        body.audioObjectPath,
      );
      if (audioErr) {
        res.status(400).json({ error: audioErr });
        return;
      }
    }

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

    const [updated] = await db
      .update(commitDraftsTable)
      .set({
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.note !== undefined ? { note: body.note } : {}),
        ...(body.instrumentType !== undefined
          ? { instrumentType: body.instrumentType }
          : {}),
        ...(body.audioObjectPath !== undefined
          ? { audioFileUrl: body.audioObjectPath }
          : {}),
        ...(body.overlayOffsetSeconds !== undefined
          ? { overlayOffsetSeconds: body.overlayOffsetSeconds }
          : {}),
        ...(body.displayNameOverride !== undefined
          ? { displayNameOverride: body.displayNameOverride }
          : {}),
        ...(body.socialHandle !== undefined
          ? { socialHandle: body.socialHandle }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(commitDraftsTable.id, draftId))
      .returning();

    const [song] = await db
      .select()
      .from(songsTable)
      .where(eq(songsTable.id, updated!.songId))
      .limit(1);

    const openRounds = await db
      .select()
      .from(roundsTable)
      .where(and(eq(roundsTable.songId, updated!.songId), eq(roundsTable.status, "open")));

    res.json(toDraft(updated!, song!, eligibleRoundFor(updated!, openRounds)));
  },
);

router.delete(
  "/commits/drafts/:draftId",
  requireAuth,
  async (req: Request, res: Response) => {
    const profile = (req as Request & { profile: { id: string } }).profile;
    const draftId = req.params.draftId as string;
    const [existing] = await db
      .select()
      .from(commitDraftsTable)
      .where(eq(commitDraftsTable.id, draftId))
      .limit(1);
    if (!existing || existing.contributorId !== profile.id) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }
    await db.delete(commitDraftsTable).where(eq(commitDraftsTable.id, draftId));
    res.status(204).end();
  },
);

router.post(
  "/commits/drafts/:draftId/submit",
  requireAuth,
  async (req: Request, res: Response) => {
    const profile = (req as Request & { profile: { id: string } }).profile;
    const draftId = req.params.draftId as string;

    const [draft] = await db
      .select()
      .from(commitDraftsTable)
      .where(eq(commitDraftsTable.id, draftId))
      .limit(1);
    if (!draft || draft.contributorId !== profile.id) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    // Find the round to submit into. Prefer an explicit roundId, otherwise
    // pick the open round on this song that matches the draft's instrument.
    const requestedRoundId =
      typeof req.body?.roundId === "string" ? req.body.roundId : null;

    let round: Round | undefined;
    if (requestedRoundId) {
      [round] = await db
        .select()
        .from(roundsTable)
        .where(eq(roundsTable.id, requestedRoundId))
        .limit(1);
    } else {
      const openRounds = await db
        .select()
        .from(roundsTable)
        .where(
          and(
            eq(roundsTable.songId, draft.songId),
            eq(roundsTable.status, "open"),
          ),
        );
      round = openRounds.find(
        (r) => r.allowedInstrumentType === draft.instrumentType,
      );
    }

    if (!round) {
      res.status(400).json({ error: "No matching open round for this draft." });
      return;
    }
    if (round.songId !== draft.songId) {
      res.status(400).json({ error: "Round does not belong to this song." });
      return;
    }
    if (round.status !== "open") {
      res.status(400).json({ error: "Round is not open for submissions." });
      return;
    }
    // When the user picks a round explicitly we let them through even if the
    // instrument label they chose at draft time doesn't match — the round's
    // allowed instrument is the source of truth and the user has affirmed
    // they want to submit here. Auto-detect already filters by instrument.
    if (
      !requestedRoundId &&
      round.allowedInstrumentType !== draft.instrumentType
    ) {
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

    const [created] = await db
      .insert(commitsTable)
      .values({
        songId: round.songId,
        roundId: round.id,
        contributorId: profile.id,
        title: draft.title,
        note: draft.note ?? null,
        instrumentType: draft.instrumentType,
        kind: round.kind,
        audioFileUrl: draft.audioFileUrl,
        overlayOffsetSeconds: draft.overlayOffsetSeconds ?? 0,
        status: "pending",
        confirmedHumanMade: true,
        confirmedRightsGrant: true,
      })
      .returning();

    await db.delete(commitDraftsTable).where(eq(commitDraftsTable.id, draft.id));

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
  },
);

export default router;
