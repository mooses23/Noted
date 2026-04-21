import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  songsTable,
  songFilesTable,
  songCreditsTable,
  roundsTable,
  commitsTable,
  versionsTable,
  versionMergesTable,
  adminActionsTable,
} from "@workspace/db";
import { and, asc, eq, desc, inArray, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { fetchCommitRows, fetchCommitById, fetchMergedVersionForCommit } from "../lib/commitQueries";
import {
  toSong,
  toSongFile,
  toSongCredit,
  toRound,
  toVersion,
  toCommitSummary,
  toContributor,
} from "../lib/shapes";
import { versionsWithMergesForSong } from "./versions";
import {
  AdminCreateSongBody,
  AdminUpdateSongBody,
  AdminAddSongFileBody,
  AdminCreateRoundBody,
  AdminUpdateRoundBody,
  AdminAdvanceSongPhaseBody,
  AdminSetCommitStatusBody,
  AdminCreateVersionBody,
  AdminCreateSongCreditBody,
  AdminUpdateSongCreditBody,
  AdminReorderSongCreditsBody,
} from "@workspace/api-zod";
import { z } from "zod";

function parseBody<S extends z.ZodTypeAny>(
  schema: S,
  body: unknown,
  res: Response,
): z.infer<S> | null {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    res.status(400).json({ error: "Invalid request body", details: result.error.flatten() });
    return null;
  }
  return result.data;
}

const router: IRouter = Router();

router.use(requireAdmin);

router.get("/songs", async (_req: Request, res: Response) => {
  const rows = await db.select().from(songsTable).orderBy(desc(songsTable.createdAt));
  res.json(rows.map(toSong));
});

router.post("/songs", async (req: Request, res: Response) => {
  const b = parseBody(AdminCreateSongBody, req.body, res);
  if (!b) return;
  const [created] = await db
    .insert(songsTable)
    .values({
      slug: b.slug,
      title: b.title,
      description: b.description ?? null,
      creatorName: b.creatorName,
      genre: b.genre,
      bpm: b.bpm,
      musicalKey: b.musicalKey,
      timeSignature: b.timeSignature ?? null,
      status: b.status ?? "active",
      phase: b.phase ?? "structure",
    })
    .returning();
  res.json(toSong(created!));
});

router.patch("/songs/:songId", async (req: Request, res: Response) => {
  const b = parseBody(AdminUpdateSongBody, req.body, res);
  if (!b) return;
  const [updated] = await db
    .update(songsTable)
    .set({
      ...(b.title !== undefined ? { title: b.title } : {}),
      ...(b.description !== undefined ? { description: b.description } : {}),
      ...(b.creatorName !== undefined ? { creatorName: b.creatorName } : {}),
      ...(b.genre !== undefined ? { genre: b.genre } : {}),
      ...(b.bpm !== undefined ? { bpm: b.bpm } : {}),
      ...(b.musicalKey !== undefined ? { musicalKey: b.musicalKey } : {}),
      ...(b.timeSignature !== undefined ? { timeSignature: b.timeSignature } : {}),
      ...(b.status !== undefined ? { status: b.status } : {}),
      ...(b.phase !== undefined ? { phase: b.phase } : {}),
      ...(b.coverImageUrl !== undefined ? { coverImageUrl: b.coverImageUrl } : {}),
      updatedAt: new Date(),
    })
    .where(eq(songsTable.id, req.params.songId as string))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(toSong(updated));
});

router.post("/songs/:songId/advance-phase", async (req: Request, res: Response) => {
  const b = parseBody(AdminAdvanceSongPhaseBody, req.body, res);
  if (!b) return;
  const songId = req.params.songId as string;
  const actor = (req as Request & { profile: { id: string } }).profile;
  const [updated] = await db
    .update(songsTable)
    .set({ phase: b.phase, updatedAt: new Date() })
    .where(eq(songsTable.id, songId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await db.insert(adminActionsTable).values({
    actorId: actor.id,
    action: `advance_phase:${b.phase}`,
    payload: JSON.stringify({ songId }),
  });
  res.json(toSong(updated));
});

router.post("/songs/:songId/files", async (req: Request, res: Response) => {
  const b = parseBody(AdminAddSongFileBody, req.body, res);
  if (!b) return;
  const [created] = await db
    .insert(songFilesTable)
    .values({
      songId: req.params.songId as string,
      fileType: b.fileType,
      label: b.label,
      fileUrl: b.fileObjectPath,
      originalFilename: b.originalFilename,
      sizeBytes: b.sizeBytes ?? null,
    })
    .returning();

  if (b.fileType === "cover") {
    await db
      .update(songsTable)
      .set({ coverImageUrl: b.fileObjectPath, updatedAt: new Date() })
      .where(eq(songsTable.id, req.params.songId as string));
  }
  res.json(toSongFile(created!));
});

router.post("/rounds", async (req: Request, res: Response) => {
  const b = parseBody(AdminCreateRoundBody, req.body, res);
  if (!b) return;
  const [{ maxNum }] = await db
    .select({ maxNum: sql<number>`coalesce(max(${roundsTable.roundNumber}), 0)::int` })
    .from(roundsTable)
    .where(eq(roundsTable.songId, b.songId));
  const [song] = await db
    .select({ currentVersionId: songsTable.currentVersionId, phase: songsTable.phase })
    .from(songsTable)
    .where(eq(songsTable.id, b.songId));
  if (!song) {
    res.status(404).json({ error: "Song not found" });
    return;
  }
  const requestedKind = b.kind ?? "structure";
  if (song.phase === "structure" && requestedKind === "accent") {
    res.status(400).json({
      error:
        "This song is still in the structure phase. Advance the song to accents before creating accent rounds.",
    });
    return;
  }
  if (song.phase === "accents" && requestedKind === "structure") {
    res.status(400).json({
      error:
        "This song is in the accents phase. Structure rounds are locked. Revert the song to structure to add a foundation round.",
    });
    return;
  }
  const [created] = await db
    .insert(roundsTable)
    .values({
      songId: b.songId,
      roundNumber: (maxNum ?? 0) + 1,
      title: b.title,
      description: b.description ?? null,
      allowedInstrumentType: b.allowedInstrumentType,
      kind: requestedKind,
      mergeBehavior: b.mergeBehavior ?? (requestedKind === "accent" ? "multi" : "single"),
      status: b.status ?? "open",
      opensAt: b.opensAt ? new Date(b.opensAt) : new Date(),
      closesAt: b.closesAt ? new Date(b.closesAt) : null,
      baseVersionId: song?.currentVersionId ?? null,
    })
    .returning();
  res.json(toRound(created!));
});

router.patch("/rounds/:roundId", async (req: Request, res: Response) => {
  const b = parseBody(AdminUpdateRoundBody, req.body, res);
  if (!b) return;
  if (b.kind !== undefined) {
    const [existingRound] = await db
      .select({ songId: roundsTable.songId })
      .from(roundsTable)
      .where(eq(roundsTable.id, req.params.roundId as string));
    if (!existingRound) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [parentSong] = await db
      .select({ phase: songsTable.phase })
      .from(songsTable)
      .where(eq(songsTable.id, existingRound.songId));
    if (parentSong?.phase === "structure" && b.kind === "accent") {
      res.status(400).json({
        error:
          "Can't change a round to accent while the song is still in the structure phase. Advance the song first.",
      });
      return;
    }
    if (parentSong?.phase === "accents" && b.kind === "structure") {
      res.status(400).json({
        error:
          "Can't change a round back to structure while the song is in the accents phase. Revert the song first.",
      });
      return;
    }
  }
  const [updated] = await db
    .update(roundsTable)
    .set({
      ...(b.title !== undefined ? { title: b.title } : {}),
      ...(b.description !== undefined ? { description: b.description } : {}),
      ...(b.allowedInstrumentType !== undefined
        ? { allowedInstrumentType: b.allowedInstrumentType }
        : {}),
      ...(b.kind !== undefined ? { kind: b.kind } : {}),
      ...(b.mergeBehavior !== undefined ? { mergeBehavior: b.mergeBehavior } : {}),
      ...(b.status !== undefined ? { status: b.status } : {}),
      ...(b.opensAt !== undefined
        ? { opensAt: b.opensAt ? new Date(b.opensAt) : null }
        : {}),
      ...(b.closesAt !== undefined
        ? { closesAt: b.closesAt ? new Date(b.closesAt) : null }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(roundsTable.id, req.params.roundId as string))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(toRound(updated));
});

router.get("/commits", async (req: Request, res: Response) => {
  const conds = [];
  if (typeof req.query.songId === "string")
    conds.push(eq(commitsTable.songId, req.query.songId));
  if (typeof req.query.roundId === "string")
    conds.push(eq(commitsTable.roundId, req.query.roundId));
  if (typeof req.query.status === "string")
    conds.push(eq(commitsTable.status, req.query.status as "pending" | "shortlisted" | "merged" | "rejected"));
  const rows = await fetchCommitRows(conds.length ? and(...conds) : undefined, {
    sort: "newest",
    limit: 200,
  });
  res.json(rows.map(toCommitSummary));
});

router.patch("/commits/:commitId/status", async (req: Request, res: Response) => {
  const b = parseBody(AdminSetCommitStatusBody, req.body, res);
  if (!b) return;
  const status = b.status;
  const [updated] = await db
    .update(commitsTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(commitsTable.id, req.params.commitId as string))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const actor = (req as Request & { profile: { id: string } }).profile;
  await db.insert(adminActionsTable).values({
    actorId: actor.id,
    action: `set_commit_status:${status}`,
    payload: JSON.stringify({ commitId: updated.id }),
  });
  const row = await fetchCommitById(updated.id);
  if (!row) {
    res.status(500).json({ error: "Failed to reload" });
    return;
  }
  const mergedVersion = await fetchMergedVersionForCommit(row.commit.id);
  res.json({
    ...toCommitSummary(row),
    round: toRound(row.round),
    mergedIntoVersion: mergedVersion ? toVersion(mergedVersion) : null,
  });
});

router.post("/versions", async (req: Request, res: Response) => {
  const b = parseBody(AdminCreateVersionBody, req.body, res);
  if (!b) return;
  const actor = (req as Request & { profile: { id: string } }).profile;

  const result = await db.transaction(async (tx) => {
    const [{ maxNum }] = await tx
      .select({ maxNum: sql<number>`coalesce(max(${versionsTable.versionNumber}), 0)::int` })
      .from(versionsTable)
      .where(eq(versionsTable.songId, b.songId));

    // Mark prior versions as not current
    await tx
      .update(versionsTable)
      .set({ isCurrent: false })
      .where(eq(versionsTable.songId, b.songId));

    const [version] = await tx
      .insert(versionsTable)
      .values({
        songId: b.songId,
        versionNumber: (maxNum ?? 0) + 1,
        title: b.title,
        description: b.description ?? null,
        officialMixUrl: b.officialMixObjectPath,
        isCurrent: true,
      })
      .returning();

    if (b.mergedCommitIds.length > 0) {
      const mergedCommits = await tx
        .select()
        .from(commitsTable)
        .where(inArray(commitsTable.id, b.mergedCommitIds));

      if (mergedCommits.length !== b.mergedCommitIds.length) {
        throw new Error("One or more merged commit IDs do not exist.");
      }
      const foreign = mergedCommits.filter((c) => c.songId !== b.songId);
      if (foreign.length > 0) {
        throw new Error(
          `Merged commits must belong to song ${b.songId}; found ${foreign.length} foreign commit(s).`,
        );
      }

      for (const c of mergedCommits) {
        await tx.insert(versionMergesTable).values({
          versionId: version!.id,
          commitId: c.id,
          contributorId: c.contributorId,
          mergeNote: b.mergeNote ?? null,
        });
        await tx
          .update(commitsTable)
          .set({ status: "merged", updatedAt: new Date() })
          .where(eq(commitsTable.id, c.id));
        // Close the round if still open
        await tx
          .update(roundsTable)
          .set({ status: "merged", updatedAt: new Date() })
          .where(eq(roundsTable.id, c.roundId));
      }
    }

    await tx
      .update(songsTable)
      .set({ currentVersionId: version!.id, updatedAt: new Date() })
      .where(eq(songsTable.id, b.songId));

    await tx.insert(adminActionsTable).values({
      actorId: actor.id,
      action: "publish_version",
      payload: JSON.stringify({
        songId: b.songId,
        versionId: version!.id,
        mergedCommitIds: b.mergedCommitIds,
      }),
    });

    return version!;
  });

  // Return full VersionWithMerges
  const all = await versionsWithMergesForSong(b.songId);
  const full = all.find((v) => v.id === result.id);
  res.json(full);
});

function isSafeHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

router.post("/songs/:songId/credits", async (req: Request, res: Response) => {
  const b = parseBody(AdminCreateSongCreditBody, req.body, res);
  if (!b) return;
  if (!isSafeHttpUrl(b.sourceUrl) || !isSafeHttpUrl(b.licenseUrl)) {
    res
      .status(400)
      .json({ error: "sourceUrl and licenseUrl must be http(s) URLs" });
    return;
  }
  const songId = req.params.songId as string;
  const actor = (req as Request & { profile: { id: string } }).profile;

  const created = await db.transaction(async (tx) => {
    const [song] = await tx
      .select({ id: songsTable.id })
      .from(songsTable)
      .where(eq(songsTable.id, songId))
      .for("update");
    if (!song) return null;

    let sortOrder = b.sortOrder;
    if (sortOrder === undefined) {
      const [{ maxSort }] = await tx
        .select({
          maxSort: sql<number>`coalesce(max(${songCreditsTable.sortOrder}), -1)::int`,
        })
        .from(songCreditsTable)
        .where(eq(songCreditsTable.songId, songId));
      sortOrder = (maxSort ?? -1) + 1;
    }
    const [row] = await tx
      .insert(songCreditsTable)
      .values({
        songId,
        title: b.title,
        author: b.author,
        sourceUrl: b.sourceUrl,
        licenseName: b.licenseName,
        licenseUrl: b.licenseUrl,
        role: b.role ?? null,
        sortOrder,
      })
      .returning();
    await tx.insert(adminActionsTable).values({
      actorId: actor.id,
      action: "create_song_credit",
      payload: JSON.stringify({ songId, creditId: row!.id, title: row!.title }),
    });
    return row!;
  });

  if (!created) {
    res.status(404).json({ error: "Song not found" });
    return;
  }
  res.json(toSongCredit(created));
});

router.patch("/credits/:creditId", async (req: Request, res: Response) => {
  const b = parseBody(AdminUpdateSongCreditBody, req.body, res);
  if (!b) return;
  if (b.sourceUrl !== undefined && !isSafeHttpUrl(b.sourceUrl)) {
    res.status(400).json({ error: "sourceUrl must be an http(s) URL" });
    return;
  }
  if (b.licenseUrl !== undefined && !isSafeHttpUrl(b.licenseUrl)) {
    res.status(400).json({ error: "licenseUrl must be an http(s) URL" });
    return;
  }
  const creditId = req.params.creditId as string;
  const actor = (req as Request & { profile: { id: string } }).profile;

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(songCreditsTable)
      .set({
        ...(b.title !== undefined ? { title: b.title } : {}),
        ...(b.author !== undefined ? { author: b.author } : {}),
        ...(b.sourceUrl !== undefined ? { sourceUrl: b.sourceUrl } : {}),
        ...(b.licenseName !== undefined ? { licenseName: b.licenseName } : {}),
        ...(b.licenseUrl !== undefined ? { licenseUrl: b.licenseUrl } : {}),
        ...(b.role !== undefined ? { role: b.role ?? null } : {}),
        ...(b.sortOrder !== undefined ? { sortOrder: b.sortOrder } : {}),
      })
      .where(eq(songCreditsTable.id, creditId))
      .returning();
    if (!row) return null;
    await tx.insert(adminActionsTable).values({
      actorId: actor.id,
      action: "update_song_credit",
      payload: JSON.stringify({
        songId: row.songId,
        creditId: row.id,
        changed: Object.keys(b),
      }),
    });
    return row;
  });

  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(toSongCredit(updated));
});

router.delete("/credits/:creditId", async (req: Request, res: Response) => {
  const creditId = req.params.creditId as string;
  const actor = (req as Request & { profile: { id: string } }).profile;
  const deleted = await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(songCreditsTable)
      .where(eq(songCreditsTable.id, creditId))
      .returning();
    if (!row) return null;
    await tx.insert(adminActionsTable).values({
      actorId: actor.id,
      action: "delete_song_credit",
      payload: JSON.stringify({ songId: row.songId, creditId: row.id, title: row.title }),
    });
    return row;
  });
  if (!deleted) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).send();
});

router.post("/songs/:songId/credits/reorder", async (req: Request, res: Response) => {
  const b = parseBody(AdminReorderSongCreditsBody, req.body, res);
  if (!b) return;
  const songId = req.params.songId as string;
  const actor = (req as Request & { profile: { id: string } }).profile;

  // Reject duplicate ids upfront.
  const uniqueIds = new Set(b.creditIds);
  if (uniqueIds.size !== b.creditIds.length) {
    res.status(400).json({ error: "creditIds must contain unique values" });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [song] = await tx
      .select({ id: songsTable.id })
      .from(songsTable)
      .where(eq(songsTable.id, songId))
      .for("update");
    if (!song) return { error: "song_missing" as const };
    // Lock the song's credit rows for the duration of this transaction so
    // that concurrent create/delete cannot race with us.
    const existing = await tx
      .select({ id: songCreditsTable.id })
      .from(songCreditsTable)
      .where(eq(songCreditsTable.songId, songId))
      .for("update");
    const existingIds = new Set(existing.map((r) => r.id));
    if (
      existingIds.size !== uniqueIds.size ||
      !b.creditIds.every((id) => existingIds.has(id))
    ) {
      return { error: "set_mismatch" as const };
    }
    for (let i = 0; i < b.creditIds.length; i++) {
      await tx
        .update(songCreditsTable)
        .set({ sortOrder: i })
        .where(
          and(
            eq(songCreditsTable.id, b.creditIds[i]!),
            eq(songCreditsTable.songId, songId),
          ),
        );
    }
    await tx.insert(adminActionsTable).values({
      actorId: actor.id,
      action: "reorder_song_credits",
      payload: JSON.stringify({ songId, creditIds: b.creditIds }),
    });
    const rows = await tx
      .select()
      .from(songCreditsTable)
      .where(eq(songCreditsTable.songId, songId))
      .orderBy(asc(songCreditsTable.sortOrder), asc(songCreditsTable.createdAt));
    return { rows };
  });

  if ("error" in result) {
    if (result.error === "song_missing") {
      res.status(404).json({ error: "Song not found" });
    } else {
      res
        .status(400)
        .json({ error: "creditIds must include exactly all credits for this song" });
    }
    return;
  }
  res.json(result.rows.map(toSongCredit));
});

export default router;
