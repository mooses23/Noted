import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  songsTable,
  songFilesTable,
  roundsTable,
  commitsTable,
  versionsTable,
  versionMergesTable,
  adminActionsTable,
} from "@workspace/db";
import { and, eq, desc, inArray, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { fetchCommitRows, fetchCommitById, fetchMergedVersionForCommit } from "../lib/commitQueries";
import {
  toSong,
  toSongFile,
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
  AdminSetCommitStatusBody,
  AdminCreateVersionBody,
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
  const [created] = await db
    .insert(roundsTable)
    .values({
      songId: b.songId,
      roundNumber: (maxNum ?? 0) + 1,
      title: b.title,
      description: b.description ?? null,
      allowedInstrumentType: b.allowedInstrumentType,
      status: b.status ?? "open",
      opensAt: b.opensAt ? new Date(b.opensAt) : new Date(),
      closesAt: b.closesAt ? new Date(b.closesAt) : null,
    })
    .returning();
  res.json(toRound(created!));
});

router.patch("/rounds/:roundId", async (req: Request, res: Response) => {
  const b = parseBody(AdminUpdateRoundBody, req.body, res);
  if (!b) return;
  const [updated] = await db
    .update(roundsTable)
    .set({
      ...(b.title !== undefined ? { title: b.title } : {}),
      ...(b.description !== undefined ? { description: b.description } : {}),
      ...(b.allowedInstrumentType !== undefined
        ? { allowedInstrumentType: b.allowedInstrumentType }
        : {}),
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

export default router;
